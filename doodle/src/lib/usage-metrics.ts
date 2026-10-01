import "server-only";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { redisCommand } from "./redis";

export type UsageEvent = {
  metric: "drawings" | "purchases";
  channel: "web" | "android";
  id: string;
  actor: string;
  email?: string | null;
  isTest?: boolean;
};

const QA_EMAILS = new Set(["samicodesit@gmail.com", "doodlereview889@gmail.com"]);
const RETENTION_SECONDS = 366 * 86_400;
const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
});
const RECORD = `
if ARGV[4] == '1' then redis.call('SADD', KEYS[3], ARGV[3]); return 0 end
if redis.call('SISMEMBER', KEYS[3], ARGV[3]) == 1 then return 0 end
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Best-effort aggregates. No prompts, images, emails or raw account/receipt IDs are stored.
export async function recordUsage(event: UsageEvent, at = new Date()): Promise<void> {
  try {
    const qa = QA_EMAILS.has(event.email?.trim().toLowerCase() ?? "");
    if (event.isTest && !qa) return;
    await redisCommand([
      "EVAL", RECORD, "3", `doodle:metrics:day:${DAY.format(at)}`,
      `doodle:metrics:seen:${hash(`${event.metric}:${event.channel}:${event.id}`)}`,
      "doodle:metrics:qa", `${event.metric}:${event.channel}`, RETENTION_SECONDS,
      hash(event.actor), qa ? "1" : "0",
    ], AbortSignal.timeout(1_500));
  } catch {
    console.warn("[doodle-metrics] count unavailable");
  }
}

export function trackUsage(event: UsageEvent): void {
  if (process.env.VERCEL_ENV !== "production") return;
  try {
    const at = new Date();
    after(() => recordUsage(event, at));
  } catch {
    console.warn("[doodle-metrics] scheduling unavailable");
  }
}
