import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { isPaidAccountActive } from "@/lib/billing/credits";
import { required } from "@/lib/supabase/env";

const COOKIE_NAME = "doodle_session";
const TTL_SECONDS = 2_592_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_KEY_PATTERN = /^[a-f0-9]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type SessionUser = { id: string; identityKey: string; email: string };
type SessionPayload = SessionUser & { exp: number };

function sign(body: string) {
  return createHmac("sha256", required("SESSION_SECRET")).update(body).digest("base64url");
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production", maxAge };
}

function sessionValue(user: SessionUser) {
  const body = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifiedPayload(value: string | undefined): SessionPayload | null {
  const [body, providedSignature, extra] = value?.split(".") ?? [];
  if (!body || !providedSignature || extra || !BASE64URL_PATTERN.test(body) || !BASE64URL_PATTERN.test(providedSignature)) return null;
  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    const { id, identityKey, email, exp } = payload as Partial<SessionPayload>;
    if (
      typeof id !== "string" || !UUID_PATTERN.test(id) ||
      typeof identityKey !== "string" || !IDENTITY_KEY_PATTERN.test(identityKey) ||
      typeof email !== "string" || email.length > 254 || !EMAIL_PATTERN.test(email) ||
      typeof exp !== "number" || !Number.isSafeInteger(exp) || exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return { id, identityKey, email, exp };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, user: SessionUser) {
  response.cookies.set(COOKIE_NAME, sessionValue(user), cookieOptions(TTL_SECONDS));
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const payload = verifiedPayload((await cookies()).get(COOKIE_NAME)?.value);
  if (!payload || !(await isPaidAccountActive(payload.id))) return null;
  return { id: payload.id, identityKey: payload.identityKey, email: payload.email };
}
