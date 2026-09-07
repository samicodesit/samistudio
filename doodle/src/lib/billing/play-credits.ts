import "server-only";

import { createHash } from "node:crypto";
import { redisCommand, redisInteger } from "@/lib/redis";

const CREDIT_QUANTITY = 10;
const VOID_REVIEW_INDEX_KEY = "doodle:play:voids:review";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CLAIM_SCRIPT = `
if redis.call('HGET', KEYS[4], 'state') == 'voided' then return {-3, 0} end
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
if redis.call('HGET', KEYS[4], 'state') == 'voided' then return {-3, 0, 'voided'} end
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-2, 0, ''} end
local owner = redis.call('HGET', KEYS[4], 'account')
if not owner then return {0, tonumber(redis.call('GET', KEYS[3]) or '0'), ''} end
if owner ~= ARGV[1] then return {-1, 0, ''} end
return {1, tonumber(redis.call('GET', KEYS[3]) or '0'), redis.call('HGET', KEYS[4], 'state') or ''}
`;

const MARK_CONSUMED_SCRIPT = `
if redis.call('HGET', KEYS[3], 'state') == 'voided' then return -2 end
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return -1 end
if redis.call('HGET', KEYS[3], 'account') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[3], 'state', 'consumed', 'consumedAt', ARGV[2])
return 1
`;

const PREVIEW_VOID_SCRIPT = `
local state = redis.call('HGET', KEYS[1], 'state')
if state == 'voided' then
  return {0, tonumber(redis.call('HGET', KEYS[1], 'recovered') or '0'), tonumber(redis.call('HGET', KEYS[1], 'unrecovered') or '0'), redis.call('HGET', KEYS[1], 'priorState') or ''}
end
local owner = redis.call('HGET', KEYS[1], 'account') or ''
if owner ~= ARGV[1] then return {-5, 0, 0, ''} end
if owner == '' then return {1, 0, 0, state or ''} end
if redis.call('EXISTS', KEYS[3]) == 1 then return {3, 0, 0, state or ''} end
if redis.call('EXISTS', KEYS[2]) == 0 then return {4, 0, ARGV[3], state or ''} end
local balance = tonumber(redis.call('GET', KEYS[4]) or '0')
local activeHolds = redis.call('ZCOUNT', KEYS[5], '(' .. ARGV[2], '+inf')
local available = math.max(0, balance - activeHolds)
local recovered = math.min(tonumber(ARGV[3]), available)
return {2, recovered, tonumber(ARGV[3]) - recovered, state or ''}
`;

const APPLY_VOID_SCRIPT = `
local state = redis.call('HGET', KEYS[1], 'state')
if state == 'voided' then
  return {0, tonumber(redis.call('HGET', KEYS[1], 'recovered') or '0'), tonumber(redis.call('HGET', KEYS[1], 'unrecovered') or '0'), redis.call('HGET', KEYS[1], 'priorState') or ''}
end
local owner = redis.call('HGET', KEYS[1], 'account') or ''
if owner ~= ARGV[1] then return {-5, 0, 0, ''} end
local priorState = state or ''
if owner == '' then
  redis.call('HSET', KEYS[1], 'state', 'voided', 'priorState', priorState, 'recovered', 0, 'unrecovered', 0, 'voidedAt', ARGV[4], 'voidedReason', ARGV[5], 'voidedSource', ARGV[6], 'voidedQuantity', 1)
  return {1, 0, 0, priorState}
end
if redis.call('EXISTS', KEYS[3]) == 1 then
  redis.call('HSET', KEYS[1], 'state', 'voided', 'priorState', priorState, 'recovered', 0, 'unrecovered', 0, 'voidedAt', ARGV[4], 'voidedReason', ARGV[5], 'voidedSource', ARGV[6], 'voidedQuantity', 1)
  return {3, 0, 0, priorState}
end
local recovered = 0
local unrecovered = tonumber(ARGV[3])
local status = 4
if redis.call('EXISTS', KEYS[2]) == 1 then
  redis.call('ZREMRANGEBYSCORE', KEYS[5], '-inf', ARGV[2])
  local balance = tonumber(redis.call('GET', KEYS[4]) or '0')
  local activeHolds = redis.call('ZCARD', KEYS[5])
  local available = math.max(0, balance - activeHolds)
  recovered = math.min(unrecovered, available)
  unrecovered = unrecovered - recovered
  if recovered > 0 then redis.call('DECRBY', KEYS[4], recovered) end
  status = 2
end
redis.call('HSET', KEYS[1], 'state', 'voided', 'priorState', priorState, 'recovered', recovered, 'unrecovered', unrecovered, 'voidedAt', ARGV[4], 'voidedReason', ARGV[5], 'voidedSource', ARGV[6], 'voidedQuantity', 1)
if unrecovered > 0 then redis.call('ZADD', KEYS[6], ARGV[7], ARGV[8]) end
return {status, recovered, unrecovered, priorState}
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

function tokenHash(purchaseToken: string) {
  return tokenKey(purchaseToken).slice("doodle:play:purchase:".length);
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
  if (status === -3) throw new Error("Purchase was voided");
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
  if (status === -3) throw new Error("Purchase was voided");
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
  if (result === -2) throw new Error("Purchase was voided");
  if (result !== 1) throw new Error("Play ledger unavailable");
}

export type PlayVoidMetadata = {
  voidedAt: string;
  voidedReason: number;
  voidedSource: number;
  voidedQuantity: 1;
};

export type PlayVoidResult = {
  status: "already_voided" | "tombstoned" | "reversed" | "deleted_account" | "inactive_account";
  recovered: number;
  unrecovered: number;
  priorState: string;
};

function voidMetadata(metadata: PlayVoidMetadata) {
  const parsed = new Date(metadata.voidedAt);
  if (
    Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== metadata.voidedAt ||
    !Number.isInteger(metadata.voidedReason) || metadata.voidedReason < 0 || metadata.voidedReason > 8 ||
    !Number.isInteger(metadata.voidedSource) || metadata.voidedSource < 0 || metadata.voidedSource > 2 ||
    metadata.voidedQuantity !== 1
  ) throw new Error("Invalid voided purchase");
  return { ...metadata, score: parsed.valueOf() };
}

function voidResult(value: unknown): PlayVoidResult | "retry" {
  if (!Array.isArray(value) || value.length !== 4) throw new Error("Play ledger unavailable");
  const status = redisInteger(value[0]);
  if (status === -5) return "retry";
  const recovered = redisInteger(value[1]);
  const unrecovered = redisInteger(value[2]);
  const priorState = value[3];
  const labels = ["already_voided", "tombstoned", "reversed", "deleted_account", "inactive_account"] as const;
  if (status < 0 || status >= labels.length || recovered < 0 || recovered > CREDIT_QUANTITY || unrecovered < 0 || unrecovered > CREDIT_QUANTITY || typeof priorState !== "string") {
    throw new Error("Play ledger unavailable");
  }
  return { status: labels[status], recovered, unrecovered, priorState };
}

async function reconcileVoid(purchaseToken: string, metadata: PlayVoidMetadata, apply: boolean): Promise<PlayVoidResult> {
  const valid = voidMetadata(metadata);
  const ledgerKey = tokenKey(purchaseToken);
  const hash = tokenHash(purchaseToken);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rawOwner = await redisCommand(["HGET", ledgerKey, "account"]);
    if (rawOwner !== null && (typeof rawOwner !== "string" || !UUID_PATTERN.test(rawOwner))) throw new Error("Play ledger unavailable");
    const owner = rawOwner ?? "";
    const keys = owner
      ? [accountKey(owner, "active"), accountKey(owner, "deleted"), accountKey(owner, "balance"), accountKey(owner, "holds")]
      : ["doodle:play:void:unused:active", "doodle:play:void:unused:deleted", "doodle:play:void:unused:balance", "doodle:play:void:unused:holds"];
    const result = voidResult(await redisCommand(apply ? [
      "EVAL", APPLY_VOID_SCRIPT, "6", ledgerKey, ...keys, VOID_REVIEW_INDEX_KEY,
      owner, Date.now(), CREDIT_QUANTITY, valid.voidedAt, valid.voidedReason, valid.voidedSource, valid.score, hash,
    ] : [
      "EVAL", PREVIEW_VOID_SCRIPT, "5", ledgerKey, ...keys,
      owner, Date.now(), CREDIT_QUANTITY,
    ]));
    if (result !== "retry") return result;
  }
  throw new Error("Play ledger unavailable");
}

export function previewPlayPurchaseVoid(purchaseToken: string, metadata: PlayVoidMetadata) {
  return reconcileVoid(purchaseToken, metadata, false);
}

export function voidPlayPurchase(purchaseToken: string, metadata: PlayVoidMetadata) {
  return reconcileVoid(purchaseToken, metadata, true);
}

export type PlayVoidReview = {
  purchaseHash: string;
  voidedAt: string;
  priorState: string;
  recovered: number;
  unrecovered: number;
  voidedReason: number;
  voidedSource: number;
};

export async function listPlayVoidReviews(limit = 100): Promise<PlayVoidReview[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid Play review limit");
  const hashes = await redisCommand(["ZREVRANGE", VOID_REVIEW_INDEX_KEY, 0, limit - 1]);
  if (!Array.isArray(hashes) || !hashes.every((hash) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Play ledger unavailable");
  }
  return Promise.all(hashes.map(async (purchaseHash) => {
    const fields = await redisCommand([
      "HMGET", `doodle:play:purchase:${purchaseHash}`,
      "voidedAt", "priorState", "recovered", "unrecovered", "voidedReason", "voidedSource",
    ]);
    if (!Array.isArray(fields) || fields.length !== 6 || !fields.every((field) => typeof field === "string")) {
      throw new Error("Play ledger unavailable");
    }
    const [voidedAt, priorState] = fields;
    const recovered = redisInteger(fields[2]);
    const unrecovered = redisInteger(fields[3]);
    const voidedReason = redisInteger(fields[4]);
    const voidedSource = redisInteger(fields[5]);
    if (recovered < 0 || recovered > CREDIT_QUANTITY || unrecovered < 1 || unrecovered > CREDIT_QUANTITY || voidedReason < 0 || voidedReason > 8 || voidedSource < 0 || voidedSource > 2) {
      throw new Error("Play ledger unavailable");
    }
    return { purchaseHash, voidedAt, priorState, recovered, unrecovered, voidedReason, voidedSource };
  }));
}
