import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifyPassphrase,
} from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const expectedPassword = process.env.DOODLE_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expectedPassword || !secret) {
    return NextResponse.json({ error: "configuration_error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_passphrase" }, { status: 401 });
  }

  const passphrase =
    typeof body === "object" && body !== null && "passphrase" in body
      ? (body as { passphrase?: unknown }).passphrase
      : undefined;

  if (typeof passphrase !== "string" || !verifyPassphrase(passphrase, expectedPassword)) {
    return NextResponse.json({ error: "invalid_passphrase" }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(secret), SESSION_COOKIE_OPTIONS);
  return response;
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
