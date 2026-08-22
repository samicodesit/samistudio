import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { deletePaidAccount } from "@/lib/billing/credits";
import { redisCommand } from "@/lib/redis";
import { required } from "@/lib/supabase/env";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREATE_ACCOUNT_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then redis.call('SET', ARGV[2] .. current .. ':active', '1'); return current end
if redis.call('SET', KEYS[1], ARGV[1], 'NX') then
  redis.call('SET', ARGV[2] .. ARGV[1] .. ':active', '1')
  return ARGV[1]
end
current = redis.call('GET', KEYS[1])
if current then redis.call('SET', ARGV[2] .. current .. ':active', '1'); return current end
return ''
`;

export type GoogleAccount = { id: string; identityKey: string };

export async function createOrGetGoogleAccount(sub: string): Promise<GoogleAccount> {
  const identityKey = createHmac("sha256", required("SESSION_SECRET")).update(sub).digest("hex");
  const id = await redisCommand([
    "EVAL", CREATE_ACCOUNT_SCRIPT, "1", `doodle:auth:google:${identityKey}`,
    randomUUID(), "doodle:account:",
  ]);
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new Error("Redis unavailable");
  return { id, identityKey };
}

export async function deleteGoogleAccount(account: GoogleAccount): Promise<void> {
  await deletePaidAccount(account.id, account.identityKey);
}
