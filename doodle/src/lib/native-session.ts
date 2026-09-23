import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { redisCommand } from "@/lib/redis";
import type { SessionUser } from "@/lib/auth/session";

export const NATIVE_SESSION_TTL_SECONDS = 2_592_000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_KEY_PATTERN = /^[a-f0-9]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

function tokenKey(token: string) {
  return "doodle:auth:native:" + createHash("sha256").update(token).digest("hex");
}

function validSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const { id, identityKey, email } = value as Partial<SessionUser>;
  return (
    typeof id === "string" &&
    UUID_PATTERN.test(id) &&
    typeof identityKey === "string" &&
    IDENTITY_KEY_PATTERN.test(identityKey) &&
    typeof email === "string" &&
    email.length <= 254 &&
    EMAIL_PATTERN.test(email)
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
      "SET",
      tokenKey(accessToken),
      JSON.stringify(user),
      "EX",
      NATIVE_SESSION_TTL_SECONDS,
      "NX",
    ]);
    if (result === "OK") {
      return {
        accessToken,
        expiresAt: Date.now() + NATIVE_SESSION_TTL_SECONDS * 1000,
      };
    }
  }
  throw new Error("Could not allocate native session");
}

export async function getNativeSessionUser(accessToken: string): Promise<SessionUser | null> {
  if (!TOKEN_PATTERN.test(accessToken)) return null;
  const value = await redisCommand(["GET", tokenKey(accessToken)]);
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return validSessionUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function revokeNativeSession(request: Request): Promise<void> {
  const accessToken = getNativeBearer(request);
  if (!accessToken) return;
  await redisCommand(["DEL", tokenKey(accessToken)]);
}
