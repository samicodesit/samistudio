import { createHash, webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { verifyAppleIdentityToken } from "./apple";

vi.mock("server-only", () => ({}));
const clientId = "nl.samistudio.doodle";
const nonce = "a".repeat(64);
const nonceHash = createHash("sha256").update(nonce).digest("hex");
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  keys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");
});
afterAll(() => vi.unstubAllGlobals());

async function token(overrides: Record<string, unknown> = {}, alternate = false) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "apple-private-subject", iss: "https://appleid.apple.com", aud: clientId, iat: now, exp: now + 300, nonce: nonceHash, email: "private@privaterelay.appleid.com", email_verified: "true", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(alternate ? otherKeys.privateKey : keys.privateKey);
}
const options = { clientId, keyResolver: async () => keys.publicKey };

describe("Apple identity verification", () => {
  it("verifies the actual signature and returns a private relay identity without email-based linking", async () => {
    await expect(verifyAppleIdentityToken(await token(), nonce, options)).resolves.toEqual({ sub: "apple-private-subject", email: "private@privaterelay.appleid.com", authenticatedAt: expect.any(Number) });
  });
  it("accepts returning users without newly supplied name or email", async () => {
    await expect(verifyAppleIdentityToken(await token({ email: undefined, email_verified: undefined }), nonce, options)).resolves.toEqual({ sub: "apple-private-subject", email: null, authenticatedAt: expect.any(Number) });
  });
  it.each([
    { aud: "another.application" },
    { iss: "https://attacker.test" },
    { nonce: "b".repeat(64) },
    { exp: 1 },
    { iat: Math.floor(Date.now() / 1000) + 120 },
    { sub: "" },
    { nonce: undefined },
  ])("rejects invalid identity claims %j", async overrides => {
    await expect(verifyAppleIdentityToken(await token(overrides), nonce, options)).rejects.toThrow();
  });
  it("rejects a token signed by a different key", async () => {
    await expect(verifyAppleIdentityToken(await token({}, true), nonce, options)).rejects.toThrow();
  });
  it("does not trust an unverified email", async () => {
    await expect(verifyAppleIdentityToken(await token({ email_verified: "false" }), nonce, options)).resolves.toMatchObject({ email: null, authenticatedAt: expect.any(Number) });
  });
});
