import "server-only";

import { createHash } from "node:crypto";
import { redisCommand, redisInteger } from "@/lib/redis";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GRANT = `
local expected = {'string', 'string', 'string', 'hash', 'set'}
for i = 1, 5 do
  local kind = redis.call('TYPE', KEYS[i]).ok
  if kind ~= 'none' and kind ~= expected[i] then return {-3, 0} end
end
if redis.call('GET', KEYS[1]) ~= '1' or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
if not balance or balance < 0 or balance % 1 ~= 0 or balance > 9007199254740991 - tonumber(ARGV[2]) then return {-3, 0} end
local prior = redis.call('HGET', KEYS[4], ARGV[1])
if prior then
  local ok, record = pcall(cjson.decode, prior)
  if not ok or type(record) ~= 'table' or record.credits ~= tonumber(ARGV[2]) or record.reason ~= ARGV[3] then return {-2, 0} end
  return {0, balance}
end
balance = redis.call('INCRBY', KEYS[3], ARGV[2])
redis.call('HSET', KEYS[4], ARGV[1], cjson.encode({credits = tonumber(ARGV[2]), reason = ARGV[3], createdAt = ARGV[4], balanceAfter = balance}))
redis.call('SADD', KEYS[5], ARGV[5])
return {1, balance}
`;

// Administrative utility only. No public route, purchase event or sale email.
export async function grantComplimentaryCredits(
  accountId: string,
  input: { grantId: string; credits: number; reason: string },
): Promise<{ granted: boolean; balance: number }> {
  if (!UUID.test(accountId) || !UUID.test(input.grantId) || !Number.isSafeInteger(input.credits) ||
    input.credits < 1 || input.credits > 500 || !/^[a-z0-9_]{1,80}$/.test(input.reason)) {
    throw new Error("Invalid complimentary grant");
  }
  const prefix = `doodle:account:${accountId}:`;
  const result = await redisCommand([
    "EVAL", GRANT, "5", prefix + "active", prefix + "deleted", prefix + "balance", prefix + "grants", "doodle:metrics:gifted",
    input.grantId, input.credits, input.reason, new Date().toISOString(), createHash("sha256").update(`account:${accountId}`).digest("hex"),
  ], AbortSignal.timeout(10_000));
  if (!Array.isArray(result) || result.length !== 2) throw new Error("Grant storage unavailable");
  const [status, balance] = result.map(redisInteger);
  if (status === -1) throw new Error("Account is not active");
  if (status === -2) throw new Error("Grant does not match its original record");
  if (![0, 1].includes(status) || balance < 0) throw new Error("Grant storage unavailable");
  return { granted: status === 1, balance };
}
