import { createOrGetGoogleAccount } from "@/lib/auth/accounts";
import { verifyGoogleCredential } from "@/lib/auth/google";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { createNativeSession } from "@/lib/native-session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return errorResponse("forbidden", 403);

  let body: Record<string, unknown>;
  try {
    body = await readNativeJson(request, 8_192);
  } catch (error) {
    if (error instanceof NativeRequestError && error.code === "body_too_large") {
      return errorResponse("request_too_large", 413);
    }
    return errorResponse("invalid_request", 400);
  }
  if (!hasExactKeys(body, ["credential"]) || typeof body.credential !== "string") {
    return errorResponse("invalid_request", 400);
  }

  let google: { sub: string; email: string };
  try {
    google = await verifyGoogleCredential(body.credential);
  } catch {
    return errorResponse("invalid_credential", 401);
  }

  try {
    const account = await createOrGetGoogleAccount(google.sub);
    const session = await createNativeSession({ ...account, email: google.email });
    return NextResponse.json(
      { authenticated: true, email: google.email, ...session },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse("auth_unavailable", 503);
  }
}
