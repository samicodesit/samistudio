import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { revokeNativeSession } from "@/lib/native-session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest, diagnostics: RequestDiagnostics) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    diagnostics.stage = "session_read";
    await revokeNativeSession(request);
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "auth_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "auth", (diagnostics) => handlePOST(request, diagnostics));
}
