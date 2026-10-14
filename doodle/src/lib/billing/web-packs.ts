import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { required } from "../env";
import { redisCommand } from "../redis";
import { getPlayCatalog, PLAY_PACK_IDS, type PlayPackId, type PlayCatalog } from "./play-catalog";
export type WebPack = PlayCatalog["packs"][number] & { unitAmount: number; currency: string };
export type WebPackCatalog = { offerEnd: string; packs: WebPack[] };
export type WebPackPromise = { productId: PlayPackId; credits: number; offerApplied: boolean; priceId: string; reference: string };
const AMOUNTS = { pack_mini: 199, pack_regular: 499, pack_big: 999 };
export function webPriceId(pack: PlayPackId) { return required("STRIPE_" + pack.toUpperCase() + "_PRICE_ID"); }
export function webIntentKey(reference: string) {
  if (!/^[a-f0-9]{64}$/.test(reference)) throw new Error("Invalid checkout promise");
  return "doodle:stripe:intent:" + reference;
}
async function checkedPrice(pack: PlayPackId) {
  const priceId = webPriceId(pack);
  const price = await getStripe().prices.retrieve(priceId, { expand: ["product"] });
  const product = price.product;
  if (price.id !== priceId || !price.active || price.type !== "one_time" || price.currency !== "eur" || price.unit_amount !== AMOUNTS[pack] || price.tax_behavior !== "inclusive"
    || price.metadata.app !== "doodle" || price.metadata.pack !== pack
    || typeof product === "string" || ("deleted" in product && product.deleted) || !("active" in product) || !product.active
    || product.metadata.app !== "doodle" || product.metadata.pack !== pack) throw new Error("Invalid pack price");
  return price;
}

// Cache only verified provider prices. Quantities and offer dates are read anew.
const priceCache = new Map<PlayPackId, { priceId: string; expiresAt: number; pending: boolean; value: Promise<Stripe.Price> }>();
function catalogPrice(pack: PlayPackId): Promise<Stripe.Price> {
  const priceId = webPriceId(pack), cached = priceCache.get(pack);
  if (cached?.priceId === priceId && (cached.pending || cached.expiresAt > Date.now())) return cached.value;
  const entry = { priceId, expiresAt: 0, pending: true, value: undefined as unknown as Promise<Stripe.Price> };
  entry.value = checkedPrice(pack).then(price => {
    entry.pending = false; entry.expiresAt = Date.now() + 30_000;
    return price;
  }, error => {
    entry.pending = false; entry.expiresAt = Date.now() + 5_000;
    throw error;
  });
  priceCache.set(pack, entry);
  return entry.value;
}

export async function getWebPackCatalog(at = new Date()): Promise<WebPackCatalog> {
  if (process.env.STRIPE_PACKS_CHECKOUT_ENABLED !== "true") throw new Error("packs_disabled");
  const catalog = getPlayCatalog(at);
  return { offerEnd: catalog.offerEnd, packs: await Promise.all(catalog.packs.map(async pack => {
    const price = await catalogPrice(pack.productId);
    return { ...pack, unitAmount: price.unit_amount!, currency: price.currency.toUpperCase() };
  })) };
}

export async function checkWebCatalogLimit(request: Request): Promise<"allowed" | "rate_limited" | "unavailable"> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return "unavailable";
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown").slice(0, 512);
  const client = createHmac("sha256", secret).update("web-catalog:" + ip).digest("hex");
  const minute = Math.floor(Date.now() / 60_000);
  const script = `
local clientCount = redis.call('INCR', KEYS[1])
if clientCount == 1 then redis.call('EXPIRE', KEYS[1], 120) end
if clientCount > 30 then return -1 end
local globalCount = redis.call('INCR', KEYS[2])
if globalCount == 1 then redis.call('EXPIRE', KEYS[2], 120) end
if globalCount > 600 then return -1 end
return 1`;
  try {
    const result = await redisCommand(["EVAL", script, "2", `doodle:stripe:catalog:client:${minute}:${client}`, `doodle:stripe:catalog:global:${minute}`], AbortSignal.timeout(1500));
    return result === 1 ? "allowed" : result === -1 ? "rate_limited" : "unavailable";
  } catch { return "unavailable"; }
}

export async function createWebPackPromise(account: string, productId: PlayPackId, expectedCredits: number, at = new Date()): Promise<WebPackPromise> {
  if (!/^[0-9a-f-]{36}$/i.test(account)) throw new Error("Invalid account");
  if (process.env.STRIPE_PACKS_CHECKOUT_ENABLED !== "true") throw new Error("packs_disabled");
  const pack = getPlayCatalog(at).packs.find(p => p.productId === productId);
  if (!pack || pack.credits !== expectedCredits) throw new Error("offer_changed");
  const price = await checkedPrice(productId), reference = randomBytes(32).toString("hex");
  const script = `
if redis.call('EXISTS',KEYS[1]) == 0 or redis.call('EXISTS',KEYS[2]) == 1 then return 0 end
local count=redis.call('INCR',KEYS[4]);if count == 1 then redis.call('EXPIRE',KEYS[4],60) end
if count > 20 then return -1 end
redis.call('HSET',KEYS[3],'account',ARGV[1],'productId',ARGV[2],'credits',ARGV[3],'offerApplied',ARGV[4],'priceId',ARGV[5],'createdAt',ARGV[6])
redis.call('EXPIRE',KEYS[3],31622400)
return 1`;
  const result = Number(await redisCommand(["EVAL", script, "4", "doodle:account:"+account+":active", "doodle:account:"+account+":deleted", webIntentKey(reference), "doodle:stripe:intent-limit:"+account, account, productId, pack.credits, pack.offerApplied ? "1" : "0", price.id, at.toISOString()]));
  if (result !== 1) throw new Error(result === -1 ? "rate_limited" : "inactive_account");
  return { productId, credits: pack.credits, offerApplied: pack.offerApplied, priceId: price.id, reference };
}
export async function readWebPackPromise(account: string, productId: string, reference: string): Promise<WebPackPromise> {
  const fields = await redisCommand(["HMGET",webIntentKey(reference),"account","productId","credits","offerApplied","priceId"]);
  if (!Array.isArray(fields) || fields.length !== 5 || fields[0] !== account || fields[1] !== productId || !PLAY_PACK_IDS.includes(productId as PlayPackId) || typeof fields[4] !== "string" || !fields[4].startsWith("price_")) throw new Error("Invalid checkout promise");
  const credits = Number(fields[2]), bonus = fields[3] === "1";
  const allowed = productId === "pack_regular" ? [20,25] : productId === "pack_mini" ? [6] : [60];
  if (!allowed.includes(credits) || !["0","1"].includes(String(fields[3])) || bonus !== (productId === "pack_regular" && credits === 25)) throw new Error("Invalid checkout promise");
  return { productId: productId as PlayPackId, credits, offerApplied: bonus, priceId: fields[4], reference };
}
