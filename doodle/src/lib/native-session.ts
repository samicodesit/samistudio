import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { redisCommand } from "@/lib/redis";
import type { SessionUser } from "@/lib/auth/session";

export const NATIVE_SESSION_TTL_SECONDS = 2_592_000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_KEY_PATTERN = /^[a-f0-9]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const CREATE_SESSION_SCRIPT = `
if ARGV[3] == 'apple' and (redis.call('HGET', KEYS[5], 'deleted') == '1' or tonumber(ARGV[4]) <= tonumber(redis.call('HGET', KEYS[5], 'revokedAt') or '-1')) then return -1 end
if redis.call('GET', KEYS[2]) ~= '1' or redis.call('EXISTS', KEYS[3]) == 1 then return -1 end
local kind = redis.call('TYPE', KEYS[4]).ok
if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid session index') end
if not redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX') then return 0 end
redis.call('SADD', KEYS[4], KEYS[1])
redis.call('EXPIRE', KEYS[4], ARGV[2])
return 1
`;

const INDEX_SESSION_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if redis.call('GET', KEYS[2]) ~= '1' or redis.call('EXISTS', KEYS[3]) == 1 then
  redis.call('DEL', KEYS[1])
  return 0
end
if ARGV[2] == 'apple' and (redis.call('HGET', KEYS[5], 'deleted') == '1' or tonumber(ARGV[3]) <= tonumber(redis.call('HGET', KEYS[5], 'revokedAt') or '-1')) then
  redis.call('DEL', KEYS[1])
  return 0
end
local remaining = redis.call('PTTL', KEYS[1])
if remaining <= 0 then return 0 end
local kind = redis.call('TYPE', KEYS[4]).ok
if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid session index') end
redis.call('SADD', KEYS[4], KEYS[1])
local indexRemaining = redis.call('PTTL', KEYS[4])
if indexRemaining < remaining then redis.call('PEXPIRE', KEYS[4], remaining) end
return 1
`;

function tokenKey(token: string) {
  return "doodle:auth:native:" + createHash("sha256").update(token).digest("hex");
}

function validSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const { id, identityKey, email, provider, appleAuthenticatedAt } = value as Partial<SessionUser>;
  return (
    typeof id === "string" &&
    UUID_PATTERN.test(id) &&
    typeof identityKey === "string" &&
    IDENTITY_KEY_PATTERN.test(identityKey) &&
    (provider === undefined || provider === "google" || provider === "apple") &&
    (provider !== "apple" || (typeof appleAuthenticatedAt === "number" && Number.isSafeInteger(appleAuthenticatedAt) && appleAuthenticatedAt >= 0)) &&
    ((provider === "apple" && email === null) ||
      (typeof email === "string" && email.length <= 254 && EMAIL_PATTERN.test(email)))
  );
}

export function getNativeBearer(request: Request): string | null | undefined {
  const value = request.headers.get("authorization");
  if (value === null) return undefined;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(value);
  return match?.[1] ?? null;
}

export async function createNativeSession(user: SessionUser) {
  if (!validSessionUser(user)) throw new Error("Invalid native session user");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const accessToken = randomBytes(32).toString("base64url");
    const result = await redisCommand([
      "EVAL", CREATE_SESSION_SCRIPT, "5",
      tokenKey(accessToken), `doodle:account:${user.id}:active`,
      `doodle:account:${user.id}:deleted`, `doodle:account:${user.id}:native-sessions`,
      `doodle:auth:apple:${user.identityKey}:state`,
      JSON.stringify(user), NATIVE_SESSION_TTL_SECONDS, user.provider ?? "google", user.appleAuthenticatedAt ?? 0,
    ]);
    if (result === 1) {
      return {
        accessToken,
        expiresAt: Date.now() + NATIVE_SESSION_TTL_SECONDS * 1000,
      };
    }
    if (result !== 0) throw new Error("Native session unavailable");
  }
  throw new Error("Could not allocate native session");
}

export async function getNativeSessionUser(accessToken: string): Promise<SessionUser | null> {
  if (!TOKEN_PATTERN.test(accessToken)) return null;
  const key = tokenKey(accessToken);
  const value = await redisCommand(["GET", key]);
  return indexStoredNativeSession(key, value);
}

// Shared by reads and the pre-deployment migration for dormant legacy sessions.
export async function indexStoredNativeSession(key: string, value: unknown): Promise<SessionUser | null> {
  if (!/^doodle:auth:native:[a-f0-9]{64}$/.test(key)) return null;
  if (typeof value !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!validSessionUser(parsed)) return null;
  const indexed = await redisCommand([
    "EVAL", INDEX_SESSION_SCRIPT, "5", key,
    `doodle:account:${parsed.id}:active`, `doodle:account:${parsed.id}:deleted`,
    `doodle:account:${parsed.id}:native-sessions`, `doodle:auth:apple:${parsed.identityKey}:state`,
    value, parsed.provider ?? "google", parsed.appleAuthenticatedAt ?? 0,
  ]);
  return indexed === 1 ? parsed : null;
}

export async function revokeNativeSession(request: Request): Promise<void> {
  const accessToken = getNativeBearer(request);
  if (!accessToken) return;
  await redisCommand(["DEL", tokenKey(accessToken)]);
}
