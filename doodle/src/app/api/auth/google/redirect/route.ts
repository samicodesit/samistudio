import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { timingSafeEqual } from "node:crypto";
import { createOrGetGoogleAccount } from "@/lib/auth/accounts";
import { verifyGoogleCredential } from "@/lib/auth/google";
import { setSessionCookie } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

const CSRF_TOKEN_MAX_LENGTH = 1024;
const CANONICAL_SITE_URL = "https://doodle.samistudio.nl";

function redirectWithAuthResult(result: "success" | "error") {
  const target = new URL("/", CANONICAL_SITE_URL);
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

async function handlePOST(request: NextRequest, diagnostics: RequestDiagnostics) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    diagnostics.failureCode = "invalid_request";
    return redirectWithAuthResult("error");
  }

  const csrfToken = form.get("g_csrf_token");
  const credential = form.get("credential");
  const cookieToken = request.cookies.get("g_csrf_token")?.value;
  if (typeof csrfToken !== "string" || !matchesCsrfToken(csrfToken, cookieToken)) {
    diagnostics.failureCode = "invalid_request";
    return redirectWithAuthResult("error");
  }
  if (typeof credential !== "string") {
    diagnostics.failureCode = "invalid_request";
    return redirectWithAuthResult("error");
  }

  diagnostics.stage = "google_token";
  let google: { sub: string; email: string };
  try {
    google = await verifyGoogleCredential(credential);
  } catch {
    diagnostics.failureCode = "invalid_credential";
    return redirectWithAuthResult("error");
  }

  try {
    diagnostics.stage = "account_read";
    const account = await createOrGetGoogleAccount(google.sub);
    const response = redirectWithAuthResult("success");
    diagnostics.stage = "session_create";
    setSessionCookie(response, { ...account, email: google.email });
    return response;
  } catch {
    diagnostics.failureCode = "auth_unavailable";
    return redirectWithAuthResult("error");
  }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "auth", (diagnostics) => handlePOST(request, diagnostics));
}
