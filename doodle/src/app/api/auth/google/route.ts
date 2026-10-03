import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { createOrGetGoogleAccount } from "@/lib/auth/accounts";
import { verifyGoogleCredential } from "@/lib/auth/google";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { setSessionCookie } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

async function handlePOST(request: NextRequest, diagnostics: RequestDiagnostics) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let credential: unknown;
  try {
    const body: unknown = await request.json();
    credential = body && typeof body === "object" && "credential" in body ? body.credential : undefined;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof credential !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  diagnostics.stage = "google_token";
  let google;
  try {
    google = await verifyGoogleCredential(credential);
  } catch {
    return NextResponse.json({ error: "invalid_credential" }, { status: 401 });
  }

  try {
    diagnostics.stage = "account_read";
    const account = await createOrGetGoogleAccount(google.sub);
    const response = new NextResponse(null, { status: 204 });
    diagnostics.stage = "session_create";
    setSessionCookie(response, { ...account, email: google.email });
    return response;
  } catch {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "auth", (diagnostics) => handlePOST(request, diagnostics));
}
