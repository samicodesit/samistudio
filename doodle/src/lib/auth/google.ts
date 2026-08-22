import "server-only";

import { OAuth2Client } from "google-auth-library";
import { required } from "@/lib/env";

const client = new OAuth2Client();

export async function verifyGoogleCredential(credential: string): Promise<{ sub: string; email: string }> {
  if (!credential || credential.length > 8192) throw new Error("Invalid Google credential");
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: required("NEXT_PUBLIC_GOOGLE_CLIENT_ID") });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("Invalid Google credential");
    return { sub: payload.sub, email: payload.email };
  } catch {
    throw new Error("Invalid Google credential");
  }
}
