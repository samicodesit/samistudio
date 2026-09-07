import "server-only";

import { createHash } from "node:crypto";
import { redisCommand, redisInteger } from "@/lib/redis";

const CREDIT_QUANTITY = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-2, 0} end
local owner = redis.call('HGET', KEYS[4], 'account')
if owner then
  if owner ~= ARGV[1] then return {-1, 0} end
  return {0, tonumber(redis.call('GET', KEYS[3]) or '0')}
end
redis.call('HSET', KEYS[4], 'account', ARGV[1], 'state', 'granted', 'createdAt', ARGV[3])
return {1, redis.call('INCRBY', KEYS[3], ARGV[2])}
`;

const READ_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-2, 0, ''} end
local owner = redis.call('HGET', KEYS[4], 'account')
if not owner then return {0, tonumber(redis.call('GET', KEYS[3]) or '0'), ''} end
if owner ~= ARGV[1] then return {-1, 0, ''} end
return {1, tonumber(redis.call('GET', KEYS[3]) or '0'), redis.call('HGET', KEYS[4], 'state') or ''}
`;

const MARK_CONSUMED_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return -1 end
if redis.call('HGET', KEYS[3], 'account') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[3], 'state', 'consumed', 'consumedAt', ARGV[2])
return 1
`;

function accountKey(accountId: string, suffix: string) {
  if (!UUID_PATTERN.test(accountId)) throw new Error("Invalid Play account");
  return `doodle:account:${accountId}:${suffix}`;
}

function tokenKey(purchaseToken: string) {
  if (purchaseToken.length < 16 || purchaseToken.length > 4_096 || /[\s\u0000-\u001f\u007f]/.test(purchaseToken)) {
    throw new Error("Invalid purchase token");
  }
  return `doodle:play:purchase:${createHash("sha256").update(purchaseToken).digest("hex")}`;
}

function pair(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error("Play ledger unavailable");
  const status = redisInteger(value[0]);
  const balance = redisInteger(value[1]);
  if (balance < 0) throw new Error("Play ledger unavailable");
  return [status, balance];
}

export async function claimPlayCredits(accountId: string, purchaseToken: string) {
  const [status, balance] = pair(await redisCommand([
    "EVAL", CLAIM_SCRIPT, "4",
    accountKey(accountId, "active"),
    accountKey(accountId, "deleted"),
    accountKey(accountId, "balance"),
    tokenKey(purchaseToken),
    accountId,
    CREDIT_QUANTITY,
    new Date().toISOString(),
  ]));
  if (status === -1) throw new Error("Purchase belongs to another account");
  if (status === -2) throw new Error("Account is not active");
  if (status !== 0 && status !== 1) throw new Error("Play ledger unavailable");
  return { granted: status === 1, balance };
}

export async function getPlayCreditClaim(accountId: string, purchaseToken: string): Promise<{ balance: number; state: "granted" | "consumed" }> {
  const result = await redisCommand([
    "EVAL", READ_SCRIPT, "4",
    accountKey(accountId, "active"),
    accountKey(accountId, "deleted"),
    accountKey(accountId, "balance"),
    tokenKey(purchaseToken),
    accountId,
  ]);
  if (!Array.isArray(result) || result.length !== 3) throw new Error("Play ledger unavailable");
  const status = redisInteger(result[0]);
  const balance = redisInteger(result[1]);
  const state = result[2];
  if (status === -1) throw new Error("Purchase belongs to another account");
  if (status === -2) throw new Error("Account is not active");
  if (status === 0) throw new Error("Purchase was not claimed");
  if (status !== 1 || balance < 0 || (state !== "granted" && state !== "consumed")) throw new Error("Play ledger unavailable");
  return { balance, state };
}

export async function markPlayPurchaseConsumed(accountId: string, purchaseToken: string): Promise<void> {
  const result = redisInteger(await redisCommand([
    "EVAL", MARK_CONSUMED_SCRIPT, "3",
    accountKey(accountId, "active"),
    accountKey(accountId, "deleted"),
    tokenKey(purchaseToken),
    accountId,
    new Date().toISOString(),
  ]));
  if (result !== 1) throw new Error("Play ledger unavailable");
}
