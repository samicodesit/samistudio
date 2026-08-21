import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "doodle_trial";
const TTL_SECONDS = 31_536_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]+$/;

const RESERVE_SCRIPT = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used >= 2 then return {0, 0} end
if not redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[1]) then return {0, 2 - used} end
used = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
return {1, 2 - used}
`;

const FINALIZE_SCRIPT = `
return redis.call('DEL', KEYS[1])
`;

const REFUND_SCRIPT = `
if redis.call('DEL', KEYS[2]) == 0 then return 0 end
local used = math.max(0, tonumber(redis.call('GET', KEYS[1]) or '0') - 1)
redis.call('SET', KEYS[1], used, 'EX', ARGV[1])
return 1
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

function reservationKey(identity: TrialIdentity, reservationId: string) {
  return `doodle:trial:reservation:${identity.id}:${reservationId}`;
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

export function getTrialIdentity(request: NextRequest): TrialIdentity {
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
  const result = await redis([
    "EVAL",
    RESERVE_SCRIPT,
    "2",
    usedKey(identity),
    reservationKey(identity, reservationId),
    TTL_SECONDS,
  ]);
  if (!Array.isArray(result) || result.length !== 2) throw redisError();
  const [reserved, remaining] = result.map(integer);
  if ((reserved !== 0 && reserved !== 1) || remaining < 0 || remaining > 2 - reserved) throw redisError();
  return { reserved: reserved === 1, remaining };
}

export async function finalizeFreeDoodle(identity: TrialIdentity, reservationId: string) {
  return commandResult(await redis(["EVAL", FINALIZE_SCRIPT, "1", reservationKey(identity, reservationId)]));
}

export async function refundFreeDoodle(identity: TrialIdentity, reservationId: string) {
  return commandResult(
    await redis([
      "EVAL",
      REFUND_SCRIPT,
      "2",
      usedKey(identity),
      reservationKey(identity, reservationId),
      TTL_SECONDS,
    ]),
  );
}
