import { timingSafeEqual } from "node:crypto";
import { createOrGetGoogleAccount } from "@/lib/auth/accounts";
import { verifyGoogleCredential } from "@/lib/auth/google";
import { setSessionCookie } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

const CSRF_TOKEN_MAX_LENGTH = 1024;

function redirectWithAuthResult(request: NextRequest, result: "success" | "error") {
  const target = new URL("/", request.url);
  target.searchParams.set("auth", result);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function matchesCsrfToken(formToken: string | null, cookieToken: string | undefined) {
  if (!formToken || !cookieToken || formToken.length > CSRF_TOKEN_MAX_LENGTH || cookieToken.length > CSRF_TOKEN_MAX_LENGTH) return false;
  const formBytes = Buffer.from(formToken);
  const cookieBytes = Buffer.from(cookieToken);
  return formBytes.length === cookieBytes.length && timingSafeEqual(formBytes, cookieBytes);
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirectWithAuthResult(request, "error");
  }

  const csrfToken = form.get("g_csrf_token");
  const credential = form.get("credential");
  const cookieToken = request.cookies.get("g_csrf_token")?.value;
  if (typeof csrfToken !== "string" || !matchesCsrfToken(csrfToken, cookieToken)) {
    return redirectWithAuthResult(request, "error");
  }
  if (typeof credential !== "string") return redirectWithAuthResult(request, "error");

  let google: { sub: string; email: string };
  try {
    google = await verifyGoogleCredential(credential);
  } catch {
    return redirectWithAuthResult(request, "error");
  }

  try {
    const account = await createOrGetGoogleAccount(google.sub);
    const response = redirectWithAuthResult(request, "success");
    setSessionCookie(response, { ...account, email: google.email });
    return response;
  } catch {
    return redirectWithAuthResult(request, "error");
  }
}
