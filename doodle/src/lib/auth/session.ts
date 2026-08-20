import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { SESSION_TTL_SECONDS } from "@/lib/app-config";

export const SESSION_COOKIE_NAME = "doodle_session";

const SESSION_PREFIX = "doodle:";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyPassphrase(passphrase: string, expected: string): boolean {
  const actualDigest = digest(passphrase);
  const expectedDigest = digest(expected);
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function createSessionToken(
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const expiresAt = now + SESSION_TTL_SECONDS;
  const payload = `${SESSION_PREFIX}${expiresAt}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);
  const expectedSignature = signature(payload, secret);
  const providedBytes = Buffer.from(providedSignature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (providedBytes.length !== expectedBytes.length) return false;

  let validSignature = false;
  try {
    validSignature = timingSafeEqual(providedBytes, expectedBytes);
  } catch {
    return false;
  }
  if (!validSignature || !payload.startsWith(SESSION_PREFIX)) return false;

  const expiresAt = Number(payload.slice(SESSION_PREFIX.length));
  return Number.isInteger(expiresAt) && expiresAt > now;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
