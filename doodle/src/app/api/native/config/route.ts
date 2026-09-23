import { getNativeAttestationConfig } from "@/lib/native-attestation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
