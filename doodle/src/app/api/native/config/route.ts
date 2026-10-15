import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { getNativeAttestationConfig } from "@/lib/native-attestation";
import { getAppleAttestationConfig } from "@/lib/apple-attestation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: Request, diagnostics: RequestDiagnostics) {
  try {
    diagnostics.stage = "config_fetch";
    if (request.headers.get("x-doodle-client") === "native-ios") {
      const config = getAppleAttestationConfig();
      return NextResponse.json({ enabled: Boolean(config), packageName: "nl.samistudio.doodle", minimumBuild: "1", attestation: "app_attest", guestEnabled: Boolean(config), environment: config?.environment ?? "production" }, { headers: { "Cache-Control": "no-store" } });
    }
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
