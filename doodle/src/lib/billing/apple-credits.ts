import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { redisCommand, redisInteger } from "@/lib/redis";
import { getPlayCatalog, PLAY_PACK_IDS, type PlayPackId } from "./play-catalog";
import type { VerifiedApplePurchase } from "./apple-purchase";

type AppleEnvironment = "Sandbox" | "Production";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BALANCE = Number.MAX_SAFE_INTEGER - 60;
export class AppleLedgerError extends Error {
  constructor(readonly kind: "invalid" | "inactive_account" | "revoked" | "unavailable") { super(`Apple ledger ${kind}`); }
}
function uuid(value: string) {
  if (typeof value !== "string" || !UUID.test(value)) throw new AppleLedgerError("invalid");
  return value.toLowerCase();
}
function environmentKey(environment: AppleEnvironment) {
  if (environment !== "Sandbox" && environment !== "Production") throw new AppleLedgerError("invalid");
  return `doodle:apple:${environment.toLowerCase()}`;
}
function accountKey(accountId: string, suffix: string) { return `doodle:account:${uuid(accountId)}:${suffix}`; }
function billingAccountKey(accountId: string, environment: AppleEnvironment, suffix: string) {
  return environment === "Production" ? accountKey(accountId, suffix) : `${environmentKey(environment)}:account:${uuid(accountId)}:${suffix}`;
}
function intentKey(token: string, environment: AppleEnvironment) { return `${environmentKey(environment)}:intent:${uuid(token)}`; }
function receiptKey(transactionId: string, environment: AppleEnvironment) {
  if (typeof transactionId !== "string" || !/^\d{1,32}$/.test(transactionId)) throw new AppleLedgerError("invalid");
  return `${environmentKey(environment)}:purchase:${createHash("sha256").update(transactionId).digest("hex")}`;
}
function validateTransaction(transaction: VerifiedApplePurchase) {
  if (transaction.bundleId !== "nl.samistudio.doodle" || transaction.type !== "Consumable" || transaction.quantity !== 1 ||
      transaction.inAppOwnershipType !== "PURCHASED" || !PLAY_PACK_IDS.includes(transaction.productId as PlayPackId) ||
      !Number.isSafeInteger(transaction.purchaseDate) || transaction.purchaseDate <= 0) throw new AppleLedgerError("invalid");
  receiptKey(transaction.transactionId, transaction.environment);
  intentKey(transaction.appAccountToken, transaction.environment);
}
const VALID_GRANT = `
local function validGrant(product, credits, offer)
  return (product == 'pack_mini' and credits == 6 and offer == '0') or
    (product == 'pack_big' and credits == 60 and offer == '0') or
    (product == 'pack_regular' and ((credits == 20 and offer == '0') or (credits == 25 and offer == '1')))
end
`;
const CREATE_INTENT = `
if redis.call('GET', KEYS[1]) ~= '1' or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local attempts = redis.call('INCR', KEYS[4])
if attempts == 1 then redis.call('EXPIRE', KEYS[4], 60) end
if attempts > 20 then return -1 end
if redis.call('EXISTS', KEYS[3]) == 1 then return -2 end
redis.call('HSET', KEYS[3], 'account', ARGV[1], 'product', ARGV[2], 'credits', ARGV[3], 'offer', ARGV[4], 'createdAt', ARGV[5])
redis.call('EXPIRE', KEYS[3], 31622400)
if ARGV[6] == '1' then
  redis.call('HSET', KEYS[5], 'account', ARGV[1], 'product', ARGV[2], 'credits', ARGV[3], 'offer', ARGV[4], 'createdAt', ARGV[5])
  redis.call('EXPIRE', KEYS[5], 31622400)
end
return 1
`;
export async function createAppleIntent(accountId: string, productId: PlayPackId, expectedCredits: number, environment: AppleEnvironment, at = new Date(), acceptSandbox = false) {
  const account = uuid(accountId);
  const pack = getPlayCatalog(at).packs.find(pack => pack.productId === productId);
  if (!pack || pack.credits !== expectedCredits) throw new Error("offer_changed");
  const appAccountToken = randomUUID();
  const result = redisInteger(await redisCommand(["EVAL", CREATE_INTENT, 5,
    accountKey(account, "active"), accountKey(account, "deleted"), intentKey(appAccountToken, environment),
    `${environmentKey(environment)}:intent-rate:${account}`, intentKey(appAccountToken, "Sandbox"), account, productId, pack.credits, pack.offerApplied ? "1" : "0", at.toISOString(), acceptSandbox && environment === "Production" ? "1" : "0"]));
  if (result === -1) throw new Error("rate_limited");
  if (result === 0) throw new AppleLedgerError("inactive_account");
  if (result !== 1) throw new AppleLedgerError("unavailable");
  return { ...pack, appAccountToken };
}
const CLAIM = VALID_GRANT + `
if redis.call('GET', KEYS[1]) ~= '1' or redis.call('EXISTS', KEYS[2]) == 1 then return {-2,0,0,0} end
local rawBalance = redis.call('GET', KEYS[3]) or '0'
local balance = tonumber(rawBalance)
if not string.match(rawBalance, '^%d+$') or (#rawBalance > 1 and string.sub(rawBalance,1,1) == '0') or
  not balance or balance < 0 or balance % 1 ~= 0 or balance > ${MAX_BALANCE} then return {-1,0,0,0} end
local state = redis.call('HGET', KEYS[4], 'state')
if state == 'revoked' then return {-3,0,0,0} end
local latestPurchase = tonumber(redis.call('HGET', KEYS[7], 'purchaseDate') or '0')
if not latestPurchase then return {-1,0,0,0} end
local function selectEnvironment()
  if tonumber(ARGV[6]) >= latestPurchase then redis.call('HSET', KEYS[7], 'purchaseDate', ARGV[6], 'environment', ARGV[7]) end
end
local owner = redis.call('HGET', KEYS[4], 'account')
if owner and state ~= 'ungranted' then
  local credits = tonumber(redis.call('HGET', KEYS[4], 'credits'))
  local offer = redis.call('HGET', KEYS[4], 'offer')
  if owner ~= ARGV[1] or redis.call('HGET', KEYS[4], 'product') ~= ARGV[2] or
    redis.call('HGET', KEYS[4], 'token') ~= ARGV[3] or state ~= 'granted' or not validGrant(ARGV[2], credits, offer) then return {-1,0,0,0} end
  selectEnvironment()
  return {0,balance,credits,tonumber(offer)}
end
local credits = tonumber(redis.call('HGET', KEYS[5], 'credits'))
local offer = redis.call('HGET', KEYS[5], 'offer')
local previousTransaction = redis.call('HGET', KEYS[5], 'transactionId')
if redis.call('HGET', KEYS[5], 'account') ~= ARGV[1] or redis.call('HGET', KEYS[5], 'product') ~= ARGV[2] or
  not validGrant(ARGV[2], credits, offer) or (previousTransaction and previousTransaction ~= ARGV[4]) then return {-1,0,0,0} end
redis.call('HSET', KEYS[5], 'transactionId', ARGV[4])
redis.call('HSET', KEYS[4], 'account', ARGV[1], 'product', ARGV[2], 'token', ARGV[3], 'credits', credits, 'offer', offer, 'state', 'granted', 'createdAt', ARGV[5])
redis.call('INCRBY', KEYS[3], credits)
redis.call('SET', KEYS[6], '1')
selectEnvironment()
return {1,balance+credits,credits,tonumber(offer)}
`;
export async function claimAppleCredits(accountId: string, transaction: VerifiedApplePurchase) {
  validateTransaction(transaction);
  if (transaction.revocationDate !== undefined) throw new AppleLedgerError("revoked");
  const account = uuid(accountId);
  const result = await redisCommand(["EVAL", CLAIM, 7, accountKey(account, "active"), accountKey(account, "deleted"),
    billingAccountKey(account, transaction.environment, "balance"), receiptKey(transaction.transactionId, transaction.environment),
    intentKey(transaction.appAccountToken, transaction.environment), billingAccountKey(account, transaction.environment, "purchased"),
    accountKey(account, "apple-billing-environment"), account, transaction.productId, uuid(transaction.appAccountToken), transaction.transactionId, new Date().toISOString(), transaction.purchaseDate, transaction.environment]);
  if (!Array.isArray(result) || result.length !== 4) throw new AppleLedgerError("unavailable");
  const [status, balance, creditsGranted, offer] = result.map(redisInteger);
  if (status === -2) throw new AppleLedgerError("inactive_account");
  if (status === -3) throw new AppleLedgerError("revoked");
  if (status === -1) throw new AppleLedgerError("invalid");
  if ((status !== 0 && status !== 1) || balance < 0 || ![6, 20, 25, 60].includes(creditsGranted) || (offer !== 0 && offer !== 1)) throw new AppleLedgerError("unavailable");
  return { status: status === 1 ? "granted" as const : "already_granted" as const, balance, creditsGranted, offerApplied: offer === 1 };
}
const REVOKE = VALID_GRANT + `
local owner = redis.call('HGET', KEYS[1], 'account') or redis.call('HGET', KEYS[2], 'account') or ''
if owner ~= ARGV[1] then return {-1,0,0} end
local product = redis.call('HGET', KEYS[1], 'product') or redis.call('HGET', KEYS[2], 'product')
local credits = tonumber(redis.call('HGET', KEYS[1], 'credits') or redis.call('HGET', KEYS[2], 'credits') or '0')
local offer = redis.call('HGET', KEYS[1], 'offer') or redis.call('HGET', KEYS[2], 'offer') or '0'
local token = redis.call('HGET', KEYS[1], 'token')
if owner ~= '' and (product ~= ARGV[2] or not validGrant(product, credits, offer)) then return {-2,0,0} end
if token and token ~= ARGV[3] then return {-2,0,0} end
local previousTarget = tonumber(redis.call('HGET', KEYS[1], 'refundCredits') or '0')
local recovered = tonumber(redis.call('HGET', KEYS[1], 'recovered') or '0')
local unrecovered = tonumber(redis.call('HGET', KEYS[1], 'unrecovered') or '0')
if not previousTarget or not recovered or not unrecovered or previousTarget < 0 or previousTarget > credits or
  recovered < 0 or unrecovered < 0 or recovered+unrecovered > credits or previousTarget % 1 ~= 0 or recovered % 1 ~= 0 or unrecovered % 1 ~= 0 then return {-2,0,0} end
local state = redis.call('HGET', KEYS[1], 'state')
local restoredAt = tonumber(redis.call('HGET', KEYS[1], 'restoredAt') or '0')
if not restoredAt then return {-2,0,0} end
if restoredAt >= tonumber(ARGV[8]) then return {0,recovered,unrecovered} end
local target = math.ceil(credits * tonumber(ARGV[4]) / 100000)
if state == 'revoked' and target <= previousTarget then return {0,recovered,unrecovered} end
local wasGranted = state == 'granted' or redis.call('HGET', KEYS[1], 'wasGranted') == '1'
local delta = math.max(0,target-previousTarget)
local available = 0
if wasGranted and redis.call('GET', KEYS[3]) == '1' and redis.call('EXISTS', KEYS[4]) == 0 then
  local rawBalance = redis.call('GET', KEYS[5]) or '0'
  local balance = tonumber(rawBalance)
  if not string.match(rawBalance, '^%d+$') or (#rawBalance > 1 and string.sub(rawBalance,1,1) == '0') or
    not balance or balance < 0 or balance % 1 ~= 0 or balance > ${MAX_BALANCE} then return {-2,0,0} end
  local active = redis.call('ZCOUNT', KEYS[6], ARGV[5], '+inf')
  available = math.max(0,balance-active)
end
local returned = wasGranted and math.min(delta,available) or 0
if wasGranted then recovered = recovered+returned; unrecovered = unrecovered+delta-returned end
local queueType = redis.call('TYPE', KEYS[7]).ok
if queueType ~= 'none' and queueType ~= 'zset' then return {-2,0,0} end
if returned > 0 then redis.call('DECRBY', KEYS[5], returned) end
redis.call('HSET', KEYS[1], 'state', 'revoked', 'account', owner, 'product', ARGV[2], 'token', ARGV[3], 'credits', credits,
  'offer', offer, 'refundCredits', target, 'revocationPercentage', ARGV[4], 'recovered', recovered, 'unrecovered', unrecovered,
  'revokedAt', ARGV[6], 'wasGranted', wasGranted and '1' or '0')
if unrecovered > 0 then redis.call('ZADD', KEYS[7], ARGV[5], ARGV[7]) end
return {wasGranted and 2 or 1,recovered,unrecovered}
`;
export async function revokeAppleCredits(transaction: VerifiedApplePurchase) {
  validateTransaction(transaction);
  const percentage = transaction.revocationPercentage ?? 100000;
  if (!Number.isSafeInteger(transaction.revocationDate) || transaction.revocationDate! <= 0 ||
      !Number.isSafeInteger(percentage) || percentage < 0 || percentage > 100000) throw new AppleLedgerError("invalid");
  const receipt = receiptKey(transaction.transactionId, transaction.environment);
  const intent = intentKey(transaction.appAccountToken, transaction.environment);
  for (let attempt = 0; attempt < 3; attempt++) {
    const owner = await redisCommand(["HGET", receipt, "account"]) ?? await redisCommand(["HGET", intent, "account"]) ?? "";
    if (typeof owner !== "string") throw new AppleLedgerError("unavailable");
    const account = owner ? uuid(owner) : "00000000-0000-4000-8000-000000000000";
    const result = await redisCommand(["EVAL", REVOKE, 7, receipt, intent, accountKey(account, "active"), accountKey(account, "deleted"),
      billingAccountKey(account, transaction.environment, "balance"), billingAccountKey(account, transaction.environment, "holds"),
      `${environmentKey(transaction.environment)}:refund-review`, owner, transaction.productId, uuid(transaction.appAccountToken), percentage,
      Date.now(), new Date(transaction.revocationDate!).toISOString(), receipt, transaction.revocationDate]);
    if (!Array.isArray(result) || result.length !== 3) throw new AppleLedgerError("unavailable");
    const [status, recovered, unrecovered] = result.map(redisInteger);
    if (status === -1) continue;
    if (status === -2) throw new AppleLedgerError("invalid");
    if (![0, 1, 2].includes(status) || recovered < 0 || unrecovered < 0 || recovered + unrecovered > 60) throw new AppleLedgerError("unavailable");
    return { status: status === 0 ? "already_revoked" as const : status === 1 ? "tombstoned" as const : "reversed" as const, recovered, unrecovered };
  }
  throw new AppleLedgerError("unavailable");
}
const RESTORE = VALID_GRANT + `
local owner = redis.call('HGET', KEYS[1], 'account') or ''
if owner ~= ARGV[1] or redis.call('HGET', KEYS[1], 'product') ~= ARGV[2] or redis.call('HGET', KEYS[1], 'token') ~= ARGV[3] then return {-1,0} end
local state = redis.call('HGET', KEYS[1], 'state')
local restoredAt = tonumber(redis.call('HGET', KEYS[1], 'restoredAt') or '0')
if not restoredAt then return {-1,0} end
if state ~= 'revoked' or restoredAt >= tonumber(ARGV[4]) then return {0,0} end
local credits = tonumber(redis.call('HGET', KEYS[1], 'credits') or '0')
local offer = redis.call('HGET', KEYS[1], 'offer') or '0'
if owner ~= '' and not validGrant(ARGV[2],credits,offer) then return {-1,0} end
local wasGranted = redis.call('HGET', KEYS[1], 'wasGranted') == '1'
local recovered = tonumber(redis.call('HGET', KEYS[1], 'recovered') or '0')
if not recovered or recovered < 0 or recovered > credits or recovered % 1 ~= 0 then return {-1,0} end
local rawBalance = redis.call('GET', KEYS[4]) or '0'
local balance = tonumber(rawBalance)
if not string.match(rawBalance, '^%d+$') or (#rawBalance > 1 and string.sub(rawBalance,1,1) == '0') or
  not balance or balance < 0 or balance % 1 ~= 0 or balance > ${MAX_BALANCE} then return {-1,0} end
local queueType = redis.call('TYPE', KEYS[5]).ok
if queueType ~= 'none' and queueType ~= 'zset' then return {-1,0} end
local active = redis.call('GET', KEYS[2]) == '1' and redis.call('EXISTS', KEYS[3]) == 0
local returned = (wasGranted and active) and recovered or 0
if returned > 0 then redis.call('INCRBY', KEYS[4], returned) end
redis.call('HSET', KEYS[1], 'state', wasGranted and 'granted' or 'ungranted', 'restoredAt', ARGV[4], 'refundCredits', '0', 'recovered', '0', 'unrecovered', '0')
redis.call('ZREM', KEYS[5], KEYS[1])
return {1,returned}
`;
export async function restoreAppleCredits(transaction: VerifiedApplePurchase, signedDate: number) {
  validateTransaction(transaction);
  if (transaction.revocationDate !== undefined || !Number.isSafeInteger(signedDate) || signedDate <= 0) throw new AppleLedgerError("invalid");
  const receipt = receiptKey(transaction.transactionId, transaction.environment);
  const owner = await redisCommand(["HGET", receipt, "account"]);
  if (owner === null) return { status: "already_restored" as const, restored: 0 };
  if (typeof owner !== "string") throw new AppleLedgerError("invalid");
  const account = owner ? uuid(owner) : "00000000-0000-4000-8000-000000000000";
  const result = await redisCommand(["EVAL", RESTORE, 5, receipt, accountKey(account, "active"), accountKey(account, "deleted"),
    billingAccountKey(account, transaction.environment, "balance"), `${environmentKey(transaction.environment)}:refund-review`,
    owner, transaction.productId, uuid(transaction.appAccountToken), signedDate]);
  if (!Array.isArray(result) || result.length !== 2) throw new AppleLedgerError("unavailable");
  const [status, restored] = result.map(redisInteger);
  if (status === -1) throw new AppleLedgerError("invalid");
  if (![0, 1].includes(status) || restored < 0 || restored > 60) throw new AppleLedgerError("unavailable");
  return { status: status === 1 ? "restored" as const : "already_restored" as const, restored };
}
