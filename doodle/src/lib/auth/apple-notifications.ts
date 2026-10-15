import "server-only";
import { createHash } from "node:crypto";
import { redisCommand } from "@/lib/redis";
import { deletePaidAccount } from "@/lib/billing/credits";
import { accountIdentityKey } from "./accounts";
import type { AppleAccountNotification } from "./apple";

const APPLY_NOTIFICATION = `
if redis.call('EXISTS', KEYS[3]) == 1 then return '' end
local account = redis.call('GET', KEYS[2]) or ''
local sessions = {}
local base = 'doodle:account:' .. account .. ':'
if account ~= '' then
  local kind = redis.call('TYPE', base .. 'native-sessions').ok
  if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid session index') end
  if kind == 'set' then sessions = redis.call('SMEMBERS', base .. 'native-sessions') end
  local prefix = 'doodle:auth:native:'
  for _, key in ipairs(sessions) do
    if #key ~= #prefix + 64 or string.sub(key, 1, #prefix) ~= prefix or string.find(string.sub(key, #prefix + 1), '[^a-f0-9]') then
      return redis.error_reply('Invalid session index')
    end
  end
end
local previous = tonumber(redis.call('HGET', KEYS[1], 'revokedAt') or '-1')
local eventTime = tonumber(ARGV[1])
if eventTime > previous then redis.call('HSET', KEYS[1], 'revokedAt', ARGV[1]) end
if ARGV[2] == 'account-deleted' then
  -- Block reads, authorization storage and account creation before cleanup.
  -- A failed cleanup returns 503; delivery is acknowledged only after it succeeds.
  redis.call('HSET', KEYS[1], 'deleted', '1')
  return account
end
if account ~= '' then
  for _, key in ipairs(sessions) do
    local value = redis.call('GET', key)
    if not value then
      redis.call('SREM', base .. 'native-sessions', key)
    else
      local ok, user = pcall(cjson.decode, value)
      if ok and type(user) == 'table' and user.id == account and user.provider == 'apple' and
          (tonumber(user.appleAuthenticatedAt) or -1) <= eventTime then
        redis.call('DEL', key)
        redis.call('SREM', base .. 'native-sessions', key)
      end
    end
  end
  if tonumber(redis.call('GET', base .. 'apple-authorized-at') or '-1') <= eventTime then
    local authorization = redis.call('GET', base .. 'apple-authorization')
    -- Keep an encrypted, short-lived receipt so in-app deletion can still
    -- compare its exact revoked authorization if this notification wins the race.
    if authorization then redis.call('SET', base .. 'apple-revoked-authorization', authorization, 'EX', 600) end
    redis.call('DEL', base .. 'apple-authorization', base .. 'apple-authorized-at')
  end
end
redis.call('SET', KEYS[3], '1', 'EX', 604800)
return ''
`;

export async function processAppleNotification(notification: AppleAccountNotification): Promise<void> {
  // Doodle does not send email to Apple users. Forwarding changes need no
  // account mutation and must never sign someone out or erase purchased credits.
  if (notification.type === "email-enabled" || notification.type === "email-disabled") return;
  const identityKey = accountIdentityKey(notification.subject, "apple");
  const processedKey = "doodle:auth:apple:notification:" + createHash("sha256").update(notification.id).digest("hex");
  const accountId = await redisCommand(["EVAL", APPLY_NOTIFICATION, "3",
    `doodle:auth:apple:${identityKey}:state`, `doodle:auth:apple:${identityKey}`, processedKey,
    notification.eventTime, notification.type,
  ]);
  if (typeof accountId !== "string" || (accountId !== "" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId))) {
    throw new Error("Apple notification storage unavailable");
  }
  if (notification.type === "account-deleted") {
    // Apple already invalidated every token for this permanently deleted identity.
    if (accountId) await deletePaidAccount(accountId, identityKey, "apple");
    const marked = await redisCommand(["SET", processedKey, "1", "EX", 604800]);
    if (marked !== "OK") throw new Error("Apple notification storage unavailable");
  }
}
