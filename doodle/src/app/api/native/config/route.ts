import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { getNativeAttestationConfig } from "@/lib/native-attestation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: Request, diagnostics: RequestDiagnostics) {
  try {
    diagnostics.stage = "config_fetch";
    const config = getNativeAttestationConfig();
    return NextResponse.json(
      {
        enabled: Boolean(config),
        packageName: "nl.samistudio.doodle",
        minimumVersionCode: 2,
        attestation: "play_integrity",
        guestEnabled: Boolean(config),
        ...(config ? { cloudProjectNumber: config.cloudProjectNumber } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "native_generation_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request) {
  return diagnoseRequest(request, "integrity", (diagnostics) => handleGET(request, diagnostics));
}
