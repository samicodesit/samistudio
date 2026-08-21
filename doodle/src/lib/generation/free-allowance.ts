import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "doodle_trial";
const TTL_SECONDS = 31_536_000;
const HOLD_TTL_SECONDS = 600;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]+$/;

const RESERVE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local active = redis.call('ZCARD', KEYS[2])
if redis.call('EXISTS', KEYS[3]) == 1 then return {0, math.max(0, 2 - used - active)} end
if redis.call('ZSCORE', KEYS[2], ARGV[3]) then return {1, math.max(0, 2 - used - active)} end
if used + active >= 2 then return {0, 0} end
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return {1, 2 - used - active - 1}
`;

const FINALIZE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if redis.call('EXISTS', KEYS[3]) == 1 then return {1, math.max(0, 2 - used)} end
if redis.call('ZREM', KEYS[2], ARGV[2]) == 0 then return {0, math.max(0, 2 - used)} end
used = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('SET', KEYS[3], 'finalized', 'NX', 'EX', ARGV[3])
return {1, math.max(0, 2 - used)}
`;

const RELEASE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
return redis.call('ZREM', KEYS[1], ARGV[2])
`;

export type TrialIdentity = { id: string };

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required");
  return secret;
}

function signature(id: string) {
  return createHmac("sha256", sessionSecret()).update(id).digest("base64url");
}

function signedCookie(id: string) {
  return `${id}.${signature(id)}`;
}

function verifiedId(value: string | undefined) {
  const [id, providedSignature, extra] = value?.split(".") ?? [];
  if (!id || !providedSignature || extra || !UUID_PATTERN.test(id) || !SIGNATURE_PATTERN.test(providedSignature)) return;

  const expectedSignature = signature(id);
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);
  return expected.length === provided.length && timingSafeEqual(expected, provided) ? id : undefined;
}

function usedKey(identity: TrialIdentity) {
  return `doodle:trial:used:${identity.id}`;
}

function holdsKey(identity: TrialIdentity) {
  return `doodle:trial:holds:${identity.id}`;
}

function finalizedKey(identity: TrialIdentity, reservationId: string) {
  return `doodle:trial:finalized:${identity.id}:${reservationId}`;
}

function redisError() {
  return new Error("Redis unavailable or returned an invalid response");
}

async function redis(command: unknown[]) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw redisError();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
  } catch {
    throw redisError();
  }
  if (!response.ok) throw redisError();

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw redisError();
  }
  if (!payload || typeof payload !== "object" || !("result" in payload)) throw redisError();
  return payload.result;
}

function integer(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed)) throw redisError();
  return parsed;
}

function usedResult(value: unknown) {
  if (value === null) return 0;
  const used = integer(value);
  if (used < 0) throw redisError();
  return used;
}

function commandResult(value: unknown) {
  const result = integer(value);
  if (result !== 0 && result !== 1) throw redisError();
  return result;
}

function finalizationResult(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) throw redisError();
  const [finalized, remaining] = value.map(integer);
  if ((finalized !== 0 && finalized !== 1) || remaining < 0 || remaining > 2) throw redisError();
  return { finalized: finalized === 1, remaining };
}

export function getTrialIdentity(request: NextRequest): TrialIdentity {
  sessionSecret();
  return { id: verifiedId(request.cookies.get(COOKIE_NAME)?.value) ?? randomUUID() };
}

export function setTrialCookie(response: NextResponse, identity: TrialIdentity) {
  response.cookies.set(COOKIE_NAME, signedCookie(identity.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
  });
}

export async function getFreeRemaining(identity: TrialIdentity) {
  const used = usedResult(await redis(["GET", usedKey(identity)]));
  return Math.max(0, 2 - used);
}

export async function reserveFreeDoodle(identity: TrialIdentity, reservationId: string) {
  const now = Date.now();
  const result = await redis([
    "EVAL",
    RESERVE_SCRIPT,
    "3",
    usedKey(identity),
    holdsKey(identity),
    finalizedKey(identity, reservationId),
    now,
    now + HOLD_TTL_SECONDS * 1000,
    reservationId,
    HOLD_TTL_SECONDS,
  ]);
  if (!Array.isArray(result) || result.length !== 2) throw redisError();
  const [reserved, remaining] = result.map(integer);
  if ((reserved !== 0 && reserved !== 1) || remaining < 0 || remaining > 2 - reserved) throw redisError();
  return { reserved: reserved === 1, remaining };
}

export async function finalizeFreeDoodle(identity: TrialIdentity, reservationId: string) {
  return finalizationResult(await redis([
    "EVAL",
    FINALIZE_SCRIPT,
    "3",
    usedKey(identity),
    holdsKey(identity),
    finalizedKey(identity, reservationId),
    Date.now(),
    reservationId,
    TTL_SECONDS,
  ]));
}

export async function releaseFreeDoodle(identity: TrialIdentity, reservationId: string) {
  return commandResult(
    await redis([
      "EVAL",
      RELEASE_SCRIPT,
      "1",
      holdsKey(identity),
      Date.now(),
      reservationId,
    ]),
  );
}
