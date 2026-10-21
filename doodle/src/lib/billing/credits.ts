import "server-only";
import { createHash } from "node:crypto";
import { funnelDeletionLua } from "../funnel-deletion";

import { redisCommand, redisInteger } from "@/lib/redis";
import { trackUsage } from "@/lib/usage-metrics";
import { notifyOwnerSale } from "./sale-notification";
import type { CreditScope } from "./apple-credit-scope";

export type CreditReservation = { reserved: boolean; remaining: number };
export type CreditFinalization = { finalized: boolean; remaining: number; firstDoodle?: true };

const HOLD_TTL_MS = 600_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_KEY_PATTERN = /^[a-f0-9]{64}$/;

const RESERVE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[1])
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
local active = redis.call('ZCARD', KEYS[4])
if redis.call('ZSCORE', KEYS[4], ARGV[3]) then return {1, math.max(0, balance - active)} end
if balance <= active then return {0, 0} end
redis.call('ZADD', KEYS[4], ARGV[2], ARGV[3])
return {1, balance - active - 1}
`;

const FINALIZE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
if redis.call('HEXISTS', KEYS[5], ARGV[2]) == 1 then
  local first = redis.call('HGET', KEYS[5], '__first_doodle__') == ARGV[2] and 1 or 0
  return {1, tonumber(redis.call('HGET', KEYS[5], ARGV[2])), first}
end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[1])
if redis.call('ZREM', KEYS[4], ARGV[2]) == 0 then return {0, 0} end
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
if balance <= 0 then return {0, 0} end
balance = redis.call('DECR', KEYS[3])
if redis.call('HLEN', KEYS[5]) == 0 then redis.call('HSET', KEYS[5], '__first_doodle__', ARGV[2]) end
redis.call('HSET', KEYS[5], ARGV[2], balance)
local first = redis.call('HGET', KEYS[5], '__first_doodle__') == ARGV[2] and 1 or 0
return {1, balance, first}
`;

const RELEASE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
return redis.call('ZREM', KEYS[1], ARGV[2])
`;

const FULFILL_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
if not balance or balance < 0 or balance ~= math.floor(balance) or balance > 9007199254740981 then return redis.error_reply('Invalid balance') end
if redis.call('EXISTS', KEYS[4]) == 1 then
 redis.call('SET', KEYS[5], '1')
 return {0, balance}
end
local remaining = redis.call('INCRBY', KEYS[3], 10)
redis.call('SET', KEYS[4], ARGV[1])
redis.call('SET', KEYS[5], '1')
return {1, remaining}
`;

const ACTIVE_ACCOUNT_SCRIPT = `
if redis.call('GET', KEYS[1]) == '1' and redis.call('EXISTS', KEYS[2]) == 0 then return 1 end
return 0
`;

const DELETE_SCRIPT = `
local mapped = redis.call('GET', KEYS[1])
if mapped ~= ARGV[1] and redis.call('EXISTS', KEYS[2]) == 0 then return 0 end
local revokedKey = 'doodle:account:' .. ARGV[1] .. ':apple-revoked-authorization'
if ARGV[3] ~= '' then
  local currentAuthorization = redis.call('GET', KEYS[11])
  if currentAuthorization ~= ARGV[3] and (currentAuthorization or redis.call('GET', revokedKey) ~= ARGV[3]) then return -1 end
end
local sessionKind = redis.call('TYPE', KEYS[10]).ok
if sessionKind ~= 'none' and sessionKind ~= 'set' then return redis.error_reply('Invalid session index') end
local sessions = {}
if sessionKind == 'set' then sessions = redis.call('SMEMBERS', KEYS[10]) end
local prefix = 'doodle:auth:native:'
for _, key in ipairs(sessions) do
  if #key ~= #prefix + 64 or string.sub(key, 1, #prefix) ~= prefix or string.find(string.sub(key, #prefix + 1), '[^a-f0-9]') then
    return redis.error_reply('Invalid session index')
  end
end
local appleKind = redis.call('TYPE', KEYS[12]).ok
if appleKind ~= 'none' and appleKind ~= 'set' then return redis.error_reply('Invalid Apple key index') end
local appleKeys = {}
if appleKind == 'set' then appleKeys = redis.call('SMEMBERS', KEYS[12]) end
for _, key in ipairs(appleKeys) do
  local production = 'doodle:apple:attest:production:key:'
  local development = 'doodle:apple:attest:development:key:'
  local prefix = ''
  if string.sub(key, 1, #production) == production then prefix = production
  elseif string.sub(key, 1, #development) == development then prefix = development end
  if prefix == '' or #key ~= #prefix + 64 or string.find(string.sub(key, #prefix + 1), '[^a-f0-9]') then
    return redis.error_reply('Invalid Apple key index')
  end
end
${funnelDeletionLua("ARGV[2]", "'doodle:metrics:funnel:aliases:'..ARGV[2]", "'doodle:metrics:funnel:'")}
redis.call('SET', KEYS[6], 'deleted')
if mapped == ARGV[1] then redis.call('DEL', KEYS[1]) end
redis.call('DEL', KEYS[2], KEYS[3], KEYS[4], KEYS[5])
redis.call('DEL', KEYS[7], KEYS[9])
if redis.call('TYPE', KEYS[8]).ok == 'set' then redis.call('SREM', KEYS[8], ARGV[2]) end
for _, key in ipairs(sessions) do redis.call('DEL', key) end
redis.call('DEL', KEYS[10], KEYS[11], 'doodle:account:' .. ARGV[1] .. ':apple-authorized-at', revokedKey)
for _, key in ipairs(appleKeys) do redis.call('DEL', key) end
redis.call('DEL', KEYS[12])
local sandbox = 'doodle:apple:sandbox:account:' .. ARGV[1] .. ':'
redis.call('DEL', sandbox .. 'balance', sandbox .. 'holds', sandbox .. 'finalized', sandbox .. 'purchased', sandbox .. 'grants',
  'doodle:account:' .. ARGV[1] .. ':apple-billing-environment')
return 1
`;

function unavailable(): never {
  throw new Error("Redis unavailable");
}

function accountKey(accountId: string, suffix: string) {
  if (!UUID_PATTERN.test(accountId)) unavailable();
  return `doodle:account:${accountId}:${suffix}`;
}
function billingKey(accountId: string, suffix: string, scope: CreditScope) {
  if (scope === "production") return accountKey(accountId, suffix);
  if (scope !== "apple-sandbox" || !UUID_PATTERN.test(accountId)) unavailable();
  return `doodle:apple:sandbox:account:${accountId}:${suffix}`;
}

function purchaseKey(checkoutSessionId: string) {
  if (!checkoutSessionId || checkoutSessionId.length > 512) unavailable();
  return `doodle:purchase:${checkoutSessionId}`;
}

function integer(value: unknown) {
  return redisInteger(value);
}

function balance(value: unknown) {
  const result = integer(value);
  if (result < 0) unavailable();
  return result;
}

function pair(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) unavailable();
  return value.map(integer) as [number, number];
}

function holdResult(value: unknown) {
  const [status, remaining] = pair(value);
  if (status === -1) return { active: false, remaining: 0 };
  if ((status !== 0 && status !== 1) || remaining < 0) unavailable();
  return { active: status === 1, remaining };
}

export async function getPaidBalance(accountId: string, scope: CreditScope = "production"): Promise<number> {
  const result = await redisCommand(["GET", billingKey(accountId, "balance", scope)]);
  return result === null ? 0 : balance(result);
}

/** Legacy balances are created only by credit fulfillment or a recorded gift.
 * Mixed historical gift/purchase accounts stay unknown until a verified purchase. */
export async function getPurchaseHistory(accountId: string, scope: CreditScope = "production"): Promise<boolean | null> {
  const value = redisInteger(await redisCommand(["EVAL",
    "if redis.call('EXISTS',KEYS[1]) == 1 then return 1 end; if redis.call('EXISTS',KEYS[2]) == 0 then return 0 end; if redis.call('EXISTS',KEYS[3]) == 1 then return -1 end; return 1",
    "3", billingKey(accountId, "purchased", scope), billingKey(accountId, "balance", scope), billingKey(accountId, "grants", scope),
  ]));
  if (![0, 1, -1].includes(value)) unavailable();
  return value === -1 ? null : value === 1;
}

export async function isPaidAccountActive(accountId: string): Promise<boolean> {
  return redisInteger(await redisCommand([
    "EVAL",
    ACTIVE_ACCOUNT_SCRIPT,
    "2",
    accountKey(accountId, "active"),
    accountKey(accountId, "deleted"),
  ])) === 1;
}

export async function reservePaidCredit(accountId: string, reservationId: string, scope: CreditScope = "production"): Promise<CreditReservation> {
  const now = Date.now();
  const result = holdResult(
    await redisCommand([
      "EVAL", RESERVE_SCRIPT, "4",
      accountKey(accountId, "active"), accountKey(accountId, "deleted"), billingKey(accountId, "balance", scope), billingKey(accountId, "holds", scope),
      now, now + HOLD_TTL_MS, reservationId,
    ]),
  );
  return { reserved: result.active, remaining: result.remaining };
}

export async function finalizePaidCredit(accountId: string, reservationId: string, scope: CreditScope = "production"): Promise<CreditFinalization> {
  const raw = await redisCommand([
      "EVAL", FINALIZE_SCRIPT, "5",
      accountKey(accountId, "active"), accountKey(accountId, "deleted"), billingKey(accountId, "balance", scope), billingKey(accountId, "holds", scope), billingKey(accountId, "finalized", scope),
      Date.now(), reservationId,
    ]);
  if (!Array.isArray(raw) || (raw.length !== 2 && raw.length !== 3)) unavailable();
  const result = holdResult(raw.slice(0, 2));
  const first = raw.length === 3 ? integer(raw[2]) : 0;
  if ((first !== 0 && first !== 1) || (first === 1 && !result.active)) unavailable();
  return { finalized: result.active, remaining: result.remaining, ...(first === 1 ? { firstDoodle: true as const } : {}) };
}

export async function releasePaidCredit(accountId: string, reservationId: string, scope: CreditScope = "production"): Promise<number> {
  const result = integer(await redisCommand(["EVAL", RELEASE_SCRIPT, "1", billingKey(accountId, "holds", scope), Date.now(), reservationId]));
  if (result !== 0 && result !== 1) unavailable();
  return result;
}

export async function fulfillCreditPack(accountId: string, checkoutSessionId: string, paymentIntentId: string, usage?: { isTest: boolean; email?: string | null }): Promise<number> {
  const [status, remaining] = pair(await redisCommand([
    "EVAL", FULFILL_SCRIPT, "5",
    accountKey(accountId, "active"), accountKey(accountId, "deleted"), accountKey(accountId, "balance"), purchaseKey(checkoutSessionId), accountKey(accountId, "purchased"),
    paymentIntentId,
  ]));
  if (status === -1) throw new Error("Account deleted");
  if ((status !== 0 && status !== 1) || remaining < 0) unavailable();
  if (status === 1 && usage) trackUsage({
    metric: "purchases", channel: "web", id: checkoutSessionId,
    actor: `account:${accountId}`, ...usage,
  });
  if (usage) notifyOwnerSale({ channel: "web", id: checkoutSessionId, isTest: usage.isTest });
  return remaining;
}

export async function deletePaidAccount(accountId: string, identityKey: string, provider: "google" | "apple" = "google", revokedAuthorization?: string): Promise<void> {
  if (!IDENTITY_KEY_PATTERN.test(identityKey) || (provider !== "google" && provider !== "apple")) unavailable();
  if (revokedAuthorization !== undefined && (provider !== "apple" || !revokedAuthorization || revokedAuthorization.length > 16_000)) unavailable();
  const result = integer(await redisCommand([
    "EVAL", DELETE_SCRIPT, "12",
    `doodle:auth:${provider}:${identityKey}`,
    accountKey(accountId, "active"), accountKey(accountId, "balance"), accountKey(accountId, "holds"), accountKey(accountId, "finalized"), accountKey(accountId, "deleted"),
    accountKey(accountId, "grants"), "doodle:metrics:gifted", accountKey(accountId, "purchased"),
    accountKey(accountId, "native-sessions"), accountKey(accountId, "apple-authorization"),
    accountKey(accountId, "apple-attest-keys"),
    accountId, createHash("sha256").update(`account:${accountId}`).digest("hex"), revokedAuthorization ?? "",
  ]));
  if (result !== 0 && result !== 1) unavailable();
}
