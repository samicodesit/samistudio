import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { deletePaidAccount } from "@/lib/billing/credits";
import { redisCommand } from "@/lib/redis";
import { required } from "@/lib/env";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREATE_ACCOUNT_SCRIPT = `
if ARGV[3] == 'apple' and redis.call('HGET', KEYS[2], 'deleted') == '1' then return '' end
local current = redis.call('GET', KEYS[1])
if current and redis.call('EXISTS', ARGV[2] .. current .. ':deleted') == 0 then
  redis.call('SET', ARGV[2] .. current .. ':active', '1')
  return current
end
if current then
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('SET', ARGV[2] .. ARGV[1] .. ':active', '1')
  return ARGV[1]
end
if redis.call('SET', KEYS[1], ARGV[1], 'NX') then
  redis.call('SET', ARGV[2] .. ARGV[1] .. ':active', '1')
  return ARGV[1]
end
current = redis.call('GET', KEYS[1])
if current and redis.call('EXISTS', ARGV[2] .. current .. ':deleted') == 0 then
  redis.call('SET', ARGV[2] .. current .. ':active', '1')
  return current
end
if current then
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('SET', ARGV[2] .. ARGV[1] .. ':active', '1')
  return ARGV[1]
end
return ''
`;

export type GoogleAccount = { id: string; identityKey: string };

export async function createOrGetGoogleAccount(sub: string): Promise<GoogleAccount> {
  return createOrGetAccount(sub, "google");
}

export async function createOrGetAppleAccount(sub: string): Promise<GoogleAccount> {
  return createOrGetAccount(sub, "apple");
}

async function createOrGetAccount(sub: string, provider: "google" | "apple"): Promise<GoogleAccount> {
  if (!sub || sub.length > 255) throw new Error("Invalid account identity");
  // Keep Google's established hash exactly stable. Apple is independently
  // namespaced and never linked by email, including private relay addresses.
  const identityKey = accountIdentityKey(sub, provider);
  const id = await redisCommand([
    "EVAL", CREATE_ACCOUNT_SCRIPT, "2", `doodle:auth:${provider}:${identityKey}`, `doodle:auth:apple:${identityKey}:state`,
    randomUUID(), "doodle:account:", provider,
  ]);
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new Error("Redis unavailable");
  return { id, identityKey };
}

export async function deleteGoogleAccount(account: GoogleAccount): Promise<void> {
  await deletePaidAccount(account.id, account.identityKey);
}

export function accountIdentityKey(sub: string, provider: "google" | "apple"): string {
  if (!sub || sub.length > 255) throw new Error("Invalid account identity");
  return createHmac("sha256", required("SESSION_SECRET")).update(provider === "google" ? sub : `apple:${sub}`).digest("hex");
}
