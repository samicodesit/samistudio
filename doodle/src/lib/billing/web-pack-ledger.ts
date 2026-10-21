import "server-only";
import { redisCommand, redisInteger } from "../redis";
import { trackFunnel } from "../funnel-metrics";
import { trackUsage } from "../usage-metrics";
import { notifyOwnerSale } from "./sale-notification";
import { webIntentKey, type WebPackPromise } from "./web-packs";
export type WebPackGrant = { productId: string; creditsGranted: number; offerApplied: boolean; balance: number };
function receiptKey(session: string) {
  if (!/^cs_[A-Za-z0-9_]{1,240}$/.test(session)) throw new Error("Invalid Stripe session");
  return "doodle:stripe:purchase:" + session;
}
export async function readStripeGrant(account: string, session: string): Promise<WebPackPromise | null> {
  const fields = await redisCommand(["HMGET",receiptKey(session),"account","productId","credits","offerApplied","priceId","reference"]);
  if (!Array.isArray(fields) || fields.length !== 6) throw new Error("Invalid Stripe receipt");
  if (fields.every(f => f === null)) return null;
  if (fields[0] !== account) throw new Error("Invalid Stripe owner");
  const allowed=fields[1]==="pack_mini"?[6]:fields[1]==="pack_regular"?[20,25]:fields[1]==="pack_big"?[60]:[];
  if(!allowed.includes(Number(fields[2])) || !["0","1"].includes(String(fields[3])) || (fields[3]==="1")!==(fields[1]==="pack_regular"&&Number(fields[2])===25) || typeof fields[4]!=="string" || !/^price_[A-Za-z0-9_]+$/.test(fields[4]) || typeof fields[5]!=="string")throw new Error("Invalid Stripe receipt");
  webIntentKey(fields[5]);
  return { productId: fields[1], credits: Number(fields[2]), offerApplied: fields[3] === "1", priceId: fields[4], reference: fields[5] } as WebPackPromise;
}
export async function fulfillStripePack(account: string, session: string, payment: string, grant: WebPackPromise, usage?: {isTest: boolean; email?: string | null}, initialRefundedCredits = 0): Promise<WebPackGrant> {
  if (!/^[0-9a-f-]{36}$/i.test(account) || !/^pi_[A-Za-z0-9_]+$/.test(payment)) throw new Error("Invalid Stripe owner");
  const allowed = grant.productId === "pack_mini" ? [6] : grant.productId === "pack_regular" ? [20,25] : grant.productId === "pack_big" ? [60] : [];
  if (!allowed.includes(grant.credits) || grant.offerApplied !== (grant.productId === "pack_regular" && grant.credits === 25)) throw new Error("Invalid Stripe grant");
  if(!Number.isInteger(initialRefundedCredits) || initialRefundedCredits<0 || initialRefundedCredits>grant.credits)throw new Error("Invalid Stripe refund");
  const script = `
if redis.call('EXISTS',KEYS[1]) == 0 or redis.call('EXISTS',KEYS[2]) == 1 then return {-1,0,0} end
local balance=tonumber(redis.call('GET',KEYS[3]) or '0')
if redis.call('EXISTS',KEYS[4]) == 1 then
 if redis.call('HGET',KEYS[4],'account') ~= ARGV[1] or redis.call('HGET',KEYS[4],'payment') ~= ARGV[3] or redis.call('HGET',KEYS[4],'reference') ~= ARGV[7] then return {-2,0,0} end
 return {0,balance,tonumber(redis.call('HGET',KEYS[4],'credits'))}
end
if redis.call('HGET',KEYS[5],'account') ~= ARGV[1] or redis.call('HGET',KEYS[5],'productId') ~= ARGV[4] or redis.call('HGET',KEYS[5],'credits') ~= ARGV[5] or redis.call('HGET',KEYS[5],'offerApplied') ~= ARGV[6] or redis.call('HGET',KEYS[5],'priceId') ~= ARGV[8] then return {-2,0,0} end
local bound=redis.call('HGET',KEYS[5],'session')
if bound and bound ~= ARGV[2] then return {-2,0,0} end
if not balance or balance < 0 or balance ~= math.floor(balance) or balance > 9007199254740991-tonumber(ARGV[5]) then return {-2,0,0} end
redis.call('HSET',KEYS[5],'session',ARGV[2])
local remaining=redis.call('INCRBY',KEYS[3],tonumber(ARGV[5])-tonumber(ARGV[9]))
redis.call('HSET',KEYS[4],'account',ARGV[1],'payment',ARGV[3],'productId',ARGV[4],'credits',ARGV[5],'offerApplied',ARGV[6],'priceId',ARGV[8],'reference',ARGV[7],'refundedCredits',ARGV[9],'recovered',ARGV[9],'unrecovered',0)
redis.call('SET',KEYS[6],'1')
return {1,remaining,tonumber(ARGV[5])}`;
  const result = await redisCommand(["EVAL",script,"6",`doodle:account:${account}:active`,`doodle:account:${account}:deleted`,`doodle:account:${account}:balance`,receiptKey(session),webIntentKey(grant.reference),`doodle:account:${account}:purchased`,account,session,payment,grant.productId,grant.credits,grant.offerApplied?"1":"0",grant.reference,grant.priceId,initialRefundedCredits]);
  if (!Array.isArray(result) || result.length !== 3) throw new Error("Stripe ledger unavailable");
  const [status,balance,credits] = result.map(redisInteger);
  if (![0,1].includes(status) || balance < 0 || credits !== grant.credits) throw new Error("Stripe ledger rejected grant");
  if (status === 1 && usage) {
    trackUsage({metric:"purchases",channel:"web",id:session,actor:"account:"+account,...usage});
    trackFunnel({metric:"purchase",actor:"account:"+account,id:session,pack:grant.productId,creditsGranted:credits,offerApplied:grant.offerApplied,...usage});
  }
  if (usage) notifyOwnerSale({channel:"web",id:session,isTest:usage.isTest,creditsGranted:credits});
  return {productId:grant.productId,creditsGranted:credits,offerApplied:grant.offerApplied,balance};
}
export async function refundStripePack(session: string, refundedCredits: number) {
  const key=receiptKey(session), account=await redisCommand(["HGET",key,"account"]);
  if (typeof account !== "string" || !/^[0-9a-f-]{36}$/i.test(account) || !Number.isInteger(refundedCredits) || refundedCredits < 0 || refundedCredits > 60) throw new Error("Invalid Stripe refund");
  const script=`
local total=tonumber(redis.call('HGET',KEYS[1],'credits') or '0')
if tonumber(ARGV[1]) > total then return {-1,0} end
local prior=tonumber(redis.call('HGET',KEYS[1],'refundedCredits') or '0')
local recovered=tonumber(redis.call('HGET',KEYS[1],'recovered') or '0')
local unrecovered=tonumber(redis.call('HGET',KEYS[1],'unrecovered') or '0')
if tonumber(ARGV[1]) <= prior then return {recovered,unrecovered} end
local delta=tonumber(ARGV[1])-prior
local available=0
if redis.call('EXISTS',KEYS[4]) == 1 and redis.call('EXISTS',KEYS[5]) == 0 then
 redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',ARGV[2])
 available=math.max(0,tonumber(redis.call('GET',KEYS[2]) or '0')-redis.call('ZCARD',KEYS[3]))
end
local reversed=math.min(delta,available)
if reversed > 0 then redis.call('DECRBY',KEYS[2],reversed) end
recovered=recovered+reversed;unrecovered=unrecovered+delta-reversed
redis.call('HSET',KEYS[1],'refundedCredits',ARGV[1],'recovered',recovered,'unrecovered',unrecovered)
return {recovered,unrecovered}`;
  const result=await redisCommand(["EVAL",script,"5",key,`doodle:account:${account}:balance`,`doodle:account:${account}:holds`,`doodle:account:${account}:active`,`doodle:account:${account}:deleted`,refundedCredits,Date.now()]);
  if (!Array.isArray(result) || result.length!==2) throw new Error("Stripe refund unavailable");
  const [recovered,unrecovered]=result.map(redisInteger);if(recovered<0||unrecovered<0||recovered+unrecovered>60)throw new Error("Stripe refund unavailable");
  return {recovered,unrecovered};
}
