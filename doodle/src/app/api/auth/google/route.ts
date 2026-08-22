import { createOrGetGoogleAccount } from "@/lib/auth/accounts";
import { verifyGoogleCredential } from "@/lib/auth/google";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { setSessionCookie } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let credential: unknown;
  try {
    const body: unknown = await request.json();
    credential = body && typeof body === "object" && "credential" in body ? body.credential : undefined;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof credential !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  let google;
  try {
    google = await verifyGoogleCredential(credential);
  } catch {
    return NextResponse.json({ error: "invalid_credential" }, { status: 401 });
  }

  try {
    const account = await createOrGetGoogleAccount(google.sub);
    const response = new NextResponse(null, { status: 204 });
    setSessionCookie(response, { ...account, email: google.email });
    return response;
  } catch {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }
}
