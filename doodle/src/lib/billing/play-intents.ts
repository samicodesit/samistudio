import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { redisCommand } from "@/lib/redis";
import { getPlayCatalog, type PlayPackId } from "./play-catalog";
export type PlayGrant = { productId: string; credits: number; offerApplied: boolean; intentRef?: string };
const REF = /^[a-f0-9]{64}$/;
const ACCOUNT = /^[0-9a-f-]{36}$/i;
export function playIntentKey(reference: string) {
 if (!REF.test(reference)) throw new Error("Invalid checkout intent");
 return "doodle:play:intent:"+reference;
}
export async function createPlayIntent(accountId: string, productId: PlayPackId, expectedCredits: number, at = new Date()) {
 if (!ACCOUNT.test(accountId)) throw new Error("Invalid account");
 if (process.env.PLAY_PACKS_CHECKOUT_ENABLED !== "true") throw new Error("packs_disabled");
 const pack=getPlayCatalog(at).packs.find(p=>p.productId===productId);
 if (!pack || pack.credits !== expectedCredits) throw new Error("offer_changed");
 const reference=randomBytes(32).toString("hex");
 const key=playIntentKey(reference);
 const script=`
 if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
 local count=redis.call('INCR', KEYS[4]); if count == 1 then redis.call('EXPIRE', KEYS[4], 60) end
 if count > 20 then return -1 end
 redis.call('HSET', KEYS[3], 'account', ARGV[1], 'productId', ARGV[2], 'credits', ARGV[3], 'offerApplied', ARGV[4], 'createdAt', ARGV[5])
 redis.call('EXPIRE', KEYS[3], 31622400)
 return 1`;
 const result=await redisCommand(["EVAL",script,"4","doodle:account:"+accountId+":active","doodle:account:"+accountId+":deleted",key,"doodle:play:intent-limit:"+accountId,accountId,productId,pack.credits,pack.offerApplied?"1":"0",at.toISOString()]);
 if (Number(result) !== 1) throw new Error(Number(result)===-1?"rate_limited":"inactive_account");
 return {...pack,obfuscatedProfileId:reference};
}
export async function readPlayIntent(accountId: string, productId: string, reference: string): Promise<PlayGrant> {
 const result=await redisCommand(["HMGET",playIntentKey(reference),"account","productId","credits","offerApplied"]);
 if (!Array.isArray(result) || result.length !== 4 || result[0]!==accountId || result[1]!==productId) throw new Error("Invalid checkout intent");
 const credits=Number(result[2]);
 const allowed=productId==="pack_mini"?[6]:productId==="pack_regular"?[20,25]:productId==="pack_big"?[60]:[];
 if (!allowed.includes(credits) || !["0","1"].includes(String(result[3])) || (result[3]==="1") !== (productId==="pack_regular" && credits===25)) throw new Error("Invalid checkout intent");
 return {productId,credits,offerApplied:result[3]==="1",intentRef:reference};
}
export function playTokenHash(token: string) {return createHash("sha256").update(token).digest("hex");}
