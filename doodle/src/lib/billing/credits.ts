import "server-only";
import { createHash } from "node:crypto";
import { funnelDeletionLua } from "../funnel-deletion";

import { redisCommand, redisInteger } from "@/lib/redis";
import { trackUsage } from "@/lib/usage-metrics";
import { notifyOwnerSale } from "./sale-notification";

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
${funnelDeletionLua("ARGV[2]", "'doodle:metrics:funnel:aliases:'..ARGV[2]", "'doodle:metrics:funnel:'")}
redis.call('SET', KEYS[6], 'deleted')
if mapped == ARGV[1] then redis.call('DEL', KEYS[1]) end
redis.call('DEL', KEYS[2], KEYS[3], KEYS[4], KEYS[5])
redis.call('DEL', KEYS[7], KEYS[9])
if redis.call('TYPE', KEYS[8]).ok == 'set' then redis.call('SREM', KEYS[8], ARGV[2]) end
return 1
`;

function unavailable(): never {
  throw new Error("Redis unavailable");
}

function accountKey(accountId: string, suffix: string) {
  if (!UUID_PATTERN.test(accountId)) unavailable();
  return `doodle:account:${accountId}:${suffix}`;
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

export async function getPaidBalance(accountId: string): Promise<number> {
  const result = await redisCommand(["GET", accountKey(accountId, "balance")]);
  return result === null ? 0 : balance(result);
}

/** Legacy balances are created only by credit fulfillment or a recorded gift.
 * Mixed historical gift/purchase accounts stay unknown until a verified purchase. */
export async function getPurchaseHistory(accountId: string): Promise<boolean | null> {
  const value = redisInteger(await redisCommand(["EVAL",
    "if redis.call('EXISTS',KEYS[1]) == 1 then return 1 end; if redis.call('EXISTS',KEYS[2]) == 0 then return 0 end; if redis.call('EXISTS',KEYS[3]) == 1 then return -1 end; return 1",
    "3", accountKey(accountId, "purchased"), accountKey(accountId, "balance"), accountKey(accountId, "grants"),
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

export async function reservePaidCredit(accountId: string, reservationId: string): Promise<CreditReservation> {
  const now = Date.now();
  const result = holdResult(
    await redisCommand([
      "EVAL", RESERVE_SCRIPT, "4",
      accountKey(accountId, "active"), accountKey(accountId, "deleted"), accountKey(accountId, "balance"), accountKey(accountId, "holds"),
      now, now + HOLD_TTL_MS, reservationId,
    ]),
  );
  return { reserved: result.active, remaining: result.remaining };
}

export async function finalizePaidCredit(accountId: string, reservationId: string): Promise<CreditFinalization> {
  const raw = await redisCommand([
      "EVAL", FINALIZE_SCRIPT, "5",
      accountKey(accountId, "active"), accountKey(accountId, "deleted"), accountKey(accountId, "balance"), accountKey(accountId, "holds"), accountKey(accountId, "finalized"),
      Date.now(), reservationId,
    ]);
  if (!Array.isArray(raw) || (raw.length !== 2 && raw.length !== 3)) unavailable();
  const result = holdResult(raw.slice(0, 2));
  const first = raw.length === 3 ? integer(raw[2]) : 0;
  if ((first !== 0 && first !== 1) || (first === 1 && !result.active)) unavailable();
  return { finalized: result.active, remaining: result.remaining, ...(first === 1 ? { firstDoodle: true as const } : {}) };
}

export async function releasePaidCredit(accountId: string, reservationId: string): Promise<number> {
  const result = integer(await redisCommand(["EVAL", RELEASE_SCRIPT, "1", accountKey(accountId, "holds"), Date.now(), reservationId]));
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

export async function deletePaidAccount(accountId: string, identityKey: string): Promise<void> {
  if (!IDENTITY_KEY_PATTERN.test(identityKey)) unavailable();
  const result = integer(await redisCommand([
    "EVAL", DELETE_SCRIPT, "9",
    `doodle:auth:google:${identityKey}`,
    accountKey(accountId, "active"), accountKey(accountId, "balance"), accountKey(accountId, "holds"), accountKey(accountId, "finalized"), accountKey(accountId, "deleted"),
    accountKey(accountId, "grants"), "doodle:metrics:gifted", accountKey(accountId, "purchased"),
    accountId, createHash("sha256").update(`account:${accountId}`).digest("hex"),
  ]));
  if (result !== 0 && result !== 1) unavailable();
}
