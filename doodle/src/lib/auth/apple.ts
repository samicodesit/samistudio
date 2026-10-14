import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`), {
  timeoutDuration: 5_000,
  cooldownDuration: 30_000,
  cacheMaxAge: 600_000,
});

export type AppleVerificationOptions = { clientId?: string; keyResolver?: JWTVerifyGetKey };

export function appleClientId(): string {
  const id = process.env.APPLE_SIGN_IN_CLIENT_ID?.trim() || "nl.samistudio.doodle";
  if (!/^[a-zA-Z0-9.-]{1,255}$/.test(id)) throw new Error("Apple authentication unavailable");
  return id;
}

async function verifiedPayload(token: string, options: AppleVerificationOptions) {
  if (typeof token !== "string" || token.length > 12_000) throw new Error("Invalid Apple credential");
  const clientId = options.clientId ?? appleClientId();
  const { payload } = await jwtVerify(token, options.keyResolver ?? appleKeys, {
    issuer: APPLE_ISSUER,
    audience: clientId,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "iat", "exp"],
    maxTokenAge: "10m",
    clockTolerance: 5,
  });
  if (payload.aud !== clientId || typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255 ||
      typeof payload.iat !== "number" || payload.iat > Math.floor(Date.now() / 1000) + 5) {
    throw new Error("Invalid Apple credential");
  }
  return payload;
}

export interface AppleIdentity {
  sub: string;
  email: string | null;
  authenticatedAt: number;
}

export async function verifyAppleIdentityToken(
  token: string,
  nonce: string,
  options: AppleVerificationOptions = {},
): Promise<AppleIdentity> {
  if (!/^[a-f0-9]{64}$/.test(nonce)) throw new Error("Invalid Apple credential");
  const payload = await verifiedPayload(token, options);
  if (typeof payload.nonce !== "string" || !/^[a-f0-9]{64}$/.test(payload.nonce) ||
      !timingSafeEqual(Buffer.from(payload.nonce, "hex"), createHash("sha256").update(nonce).digest())) {
    throw new Error("Invalid Apple credential");
  }
  const verifiedEmail = payload.email_verified === true || payload.email_verified === "true";
  const email = verifiedEmail && typeof payload.email === "string" && payload.email.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(payload.email)
    ? payload.email : null;
  return { sub: payload.sub!, email, authenticatedAt: payload.iat! };
}

export async function verifyAppleCodeIdentity(token: string, subject: string, options: AppleVerificationOptions = {}): Promise<void> {
  const payload = await verifiedPayload(token, options);
  if (payload.sub !== subject) throw new Error("Invalid Apple credential");
}

export type AppleAccountNotification = {
  id: string;
  type: "email-enabled" | "email-disabled" | "consent-revoked" | "account-deleted";
  subject: string;
  eventTime: number;
};

export class AppleNotificationError extends Error {
  constructor(readonly kind: "invalid" | "unavailable") {
    super("Apple notification " + kind);
  }
}

export async function verifyAppleNotification(token: string, options: AppleVerificationOptions = {}): Promise<AppleAccountNotification> {
  const invalid = () => new AppleNotificationError("invalid");
  if (typeof token !== "string" || !token || token.length > 12_000) throw invalid();
  const clientId = options.clientId ?? appleClientId();
  let payload;
  try {
    ({ payload } = await jwtVerify(token, options.keyResolver ?? appleKeys, {
      issuer: APPLE_ISSUER, audience: clientId, algorithms: ["RS256"],
      requiredClaims: ["iat", "jti", "events"], clockTolerance: 5,
      // Notifications may be retried later and do not require an exp claim.
      // Identity-token freshness and nonce rules do not apply to these events.
    }));
  } catch (failure) {
    throw new AppleNotificationError(failure instanceof errors.JOSEError && !(failure instanceof errors.JWKSTimeout) ? "invalid" : "unavailable");
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== clientId || !Number.isSafeInteger(payload.iat) || payload.iat! < 0 || payload.iat! > now + 5 ||
      typeof payload.jti !== "string" || !payload.jti || payload.jti.length > 255) throw invalid();
  let events: unknown = payload.events;
  if (typeof events === "string") {
    try { events = JSON.parse(events); } catch { throw invalid(); }
  }
  if (!events || typeof events !== "object" || Array.isArray(events)) throw invalid();
  const { type, sub, event_time: eventTime } = events as Record<string, unknown>;
  if (type !== "email-enabled" && type !== "email-disabled" && type !== "consent-revoked" && type !== "account-deleted") throw invalid();
  if (typeof sub !== "string" || !sub || sub.length > 255 || typeof eventTime !== "number" ||
      !Number.isSafeInteger(eventTime) || eventTime < 0 || eventTime > payload.iat! + 5 || eventTime > now + 5) throw invalid();
  return { id: payload.jti, type, subject: sub, eventTime };
}
