import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { verifyAppleNotification } from "./apple";

vi.mock("server-only", () => ({}));
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
const now = Math.floor(Date.now() / 1000);
const event = { type: "consent-revoked", sub: "private-apple-subject", event_time: now - 60 };
const options = { clientId: "nl.samistudio.doodle", keyResolver: async () => keys.publicKey };
beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  keys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");
});
afterAll(() => vi.unstubAllGlobals());
async function signed(overrides: Record<string, unknown> = {}, alternate = false) {
  return new SignJWT({ iss: "https://appleid.apple.com", aud: "nl.samistudio.doodle", iat: now, jti: "notification-123", events: event, ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "apple-test-key" }).sign(alternate ? otherKeys.privateKey : keys.privateKey);
}

describe("verified Apple account notifications", () => {
  it("verifies notifications without identity-token-only nonce, subject or expiry claims", async () => {
    await expect(verifyAppleNotification(await signed(), options)).resolves.toEqual({ id: "notification-123", type: "consent-revoked", subject: "private-apple-subject", eventTime: now - 60 });
  });
  it("accepts Apple's object and JSON-string events and delayed signed retries", async () => {
    await expect(verifyAppleNotification(await signed({ iat: now - 86400, events: JSON.stringify({ ...event, event_time: now - 86401 }) }), options)).resolves.toMatchObject({ type: "consent-revoked" });
  });
  it.each(["email-enabled", "email-disabled", "account-deleted"])("accepts the documented %s event", async type => {
    await expect(verifyAppleNotification(await signed({ events: { ...event, type } }), options)).resolves.toMatchObject({ type });
  });
  it.each([
    { iss: "https://attacker.test" }, { aud: "another.app" }, { aud: ["nl.samistudio.doodle", "another.app"] },
    { iat: now + 120 }, { iat: undefined }, { jti: "" }, { events: "{" },
    { events: { ...event, sub: "" } }, { events: { ...event, type: "unknown" } },
    { events: { ...event, event_time: now + 120 } }, { events: { ...event, event_time: -1 } },
    { exp: now - 60 },
  ])("rejects malformed or misdirected signed notification %j", async overrides => {
    await expect(verifyAppleNotification(await signed(overrides), options)).rejects.toThrow();
  });
  it("rejects a forged signature", async () => {
    await expect(verifyAppleNotification(await signed({}, true), options)).rejects.toThrow();
  });
});
