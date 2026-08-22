import "server-only";

import { redisCommand, redisInteger } from "@/lib/redis";

export type CreditReservation = { reserved: boolean; remaining: number };
export type CreditFinalization = { finalized: boolean; remaining: number };

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
if redis.call('HEXISTS', KEYS[5], ARGV[2]) == 1 then return {1, tonumber(redis.call('HGET', KEYS[5], ARGV[2]))} end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[1])
if redis.call('ZREM', KEYS[4], ARGV[2]) == 0 then return {0, 0} end
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
if balance <= 0 then return {0, 0} end
balance = redis.call('DECR', KEYS[3])
redis.call('HSET', KEYS[5], ARGV[2], balance)
return {1, balance}
`;

const RELEASE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
return redis.call('ZREM', KEYS[1], ARGV[2])
`;

const FULFILL_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
if redis.call('EXISTS', KEYS[4]) == 1 then return {0, tonumber(redis.call('GET', KEYS[3]) or '0')} end
redis.call('SET', KEYS[4], ARGV[1])
return {1, redis.call('INCRBY', KEYS[3], 10)}
`;

const DELETE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[6], 'deleted')
redis.call('DEL', KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5])
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

export async function isPaidAccountActive(accountId: string): Promise<boolean> {
  return (await redisCommand(["GET", accountKey(accountId, "active")])) === "1";
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
  const result = holdResult(
    await redisCommand([
      "EVAL", FINALIZE_SCRIPT, "5",
      accountKey(accountId, "active"), accountKey(accountId, "deleted"), accountKey(accountId, "balance"), accountKey(accountId, "holds"), accountKey(accountId, "finalized"),
      Date.now(), reservationId,
    ]),
  );
  return { finalized: result.active, remaining: result.remaining };
}

export async function releasePaidCredit(accountId: string, reservationId: string): Promise<number> {
  const result = integer(await redisCommand(["EVAL", RELEASE_SCRIPT, "1", accountKey(accountId, "holds"), Date.now(), reservationId]));
  if (result !== 0 && result !== 1) unavailable();
  return result;
}

export async function fulfillCreditPack(accountId: string, checkoutSessionId: string, paymentIntentId: string): Promise<number> {
  const [status, remaining] = pair(await redisCommand([
    "EVAL", FULFILL_SCRIPT, "4",
    accountKey(accountId, "active"), accountKey(accountId, "deleted"), accountKey(accountId, "balance"), purchaseKey(checkoutSessionId),
    paymentIntentId,
  ]));
  if (status === -1) throw new Error("Account deleted");
  if ((status !== 0 && status !== 1) || remaining < 0) unavailable();
  return remaining;
}

export async function deletePaidAccount(accountId: string, identityKey: string): Promise<void> {
  if (!IDENTITY_KEY_PATTERN.test(identityKey)) unavailable();
  const result = integer(await redisCommand([
    "EVAL", DELETE_SCRIPT, "6",
    `doodle:auth:google:${identityKey}`,
    accountKey(accountId, "active"), accountKey(accountId, "balance"), accountKey(accountId, "holds"), accountKey(accountId, "finalized"), accountKey(accountId, "deleted"),
    accountId,
  ]));
  if (result !== 0 && result !== 1) unavailable();
}
