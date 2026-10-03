import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { redisCommand } from "../redis";

type Sale = { channel: "android" | "web"; id: string; isTest: boolean };
const ORDERS = "https://play.google.com/console/u/0/developers/5843530199260119810/orders";
const FINISH = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if ARGV[2] == 'sent' then redis.call('SET', KEYS[1], 'sent')
else redis.call('DEL', KEYS[1]) end
return 1
`;

// Owner-only operational email. No customer email, prompt, or purchase token is sent.
export async function sendOwnerSale(sale: Sale): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (sale.isTest || !apiKey || process.env.VERCEL_ENV !== "production") return;
  const fingerprint = createHash("sha256").update(`${sale.channel}:${sale.id}`).digest("hex");
  const key = `doodle:notifications:sale:${fingerprint}`;
  const lock = randomUUID();
  let locked = false;
  let sent = false;
  try {
    locked = await redisCommand(["SET", key, lock, "NX", "EX", 60], AbortSignal.timeout(2_000)) === "OK";
    if (!locked) return;
    const platform = sale.channel === "android" ? "Google Play" : "the website";
    const dashboard = sale.channel === "android" ? ORDERS : "https://dashboard.stripe.com/payments";
    const body = JSON.stringify({
      from: "Doodle <updates@autolister.app>",
      to: ["samicodesit@gmail.com"],
      subject: `Doodle sale: 10 doodles on ${platform}`,
      text: `A real 10-doodle pack was purchased on ${platform}.\n\n10 doodles have been delivered to the customer's account.\n\nView the payment details and amount:\n${dashboard}\n\nThis is a sale notification, not a bank payout confirmation.`,
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `doodle-sale/${fingerprint}` },
          body,
          signal: AbortSignal.timeout(5_000),
        });
        if (response.ok && typeof (await response.json()).id === "string") { sent = true; break; }
        if (response.status >= 400 && response.status < 500 && response.status !== 429 && response.status !== 409) break;
      } catch { /* Retry with the same body and idempotency key. */ }
    }
    if (!sent) console.warn("[doodle-sale] email unavailable");
  } catch {
    console.warn("[doodle-sale] notification unavailable");
  } finally {
    if (locked) {
      try {
        await redisCommand(["EVAL", FINISH, "1", key, lock, sent ? "sent" : "retry"], AbortSignal.timeout(2_000));
      } catch { console.warn("[doodle-sale] delivery marker unavailable"); }
    }
  }
}

export function notifyOwnerSale(sale: Sale): void {
  if (sale.isTest || !process.env.RESEND_API_KEY || process.env.VERCEL_ENV !== "production") return;
  try { after(() => sendOwnerSale(sale)); }
  catch { console.warn("[doodle-sale] scheduling unavailable"); }
}
