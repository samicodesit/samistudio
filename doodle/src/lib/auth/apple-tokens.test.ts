import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { exchangeAppleAuthorizationCode, getAppleSignInConfig, revokeAppleAuthorization, storeAppleAuthorization, type AppleSignInConfig } from "./apple-tokens";

vi.mock("server-only", () => ({}));
const redisCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/redis", () => ({ redisCommand }));
const accountId = "11111111-1111-4111-8111-111111111111";
const otherAccount = "22222222-2222-4222-8222-222222222222";
let config: AppleSignInConfig;
let signingKeys: Awaited<ReturnType<typeof generateKeyPair>>;
let appleKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  signingKeys = await generateKeyPair("ES256", { extractable: true });
  appleKeys = await generateKeyPair("RS256");
  config = { clientId: "nl.samistudio.doodle", teamId: "8QN97U5U42", keyId: "TESTKEY123", privateKey: await exportPKCS8(signingKeys.privateKey) };
});
beforeEach(() => {
  redisCommand.mockReset().mockResolvedValue(1);
  vi.stubEnv("SESSION_SECRET", "a-test-encryption-secret-with-sufficient-length-for-tests");
  vi.stubEnv("APPLE_AUTHORIZATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64url"));
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function idToken(subject = "apple-subject") {
  return new SignJWT({ sub: subject }).setProtectedHeader({ alg: "RS256" }).setIssuer("https://appleid.apple.com").setAudience(config.clientId).setIssuedAt().setExpirationTime("5m").sign(appleKeys.privateKey);
}

describe("Apple authorization lifecycle", () => {
  it("requires a separate encryption key without changing existing Google account identities", async () => {
    vi.stubEnv("APPLE_TEAM_ID", config.teamId);
    vi.stubEnv("APPLE_SIGN_IN_KEY_ID", config.keyId);
    vi.stubEnv("APPLE_SIGN_IN_PRIVATE_KEY", config.privateKey);
    vi.stubEnv("APPLE_AUTHORIZATION_ENCRYPTION_KEY", "");
    expect(() => getAppleSignInConfig()).toThrow();
    await expect(storeAppleAuthorization({ id: accountId, identityKey: "a".repeat(64) }, "test-refresh-token", 100)).rejects.toThrow();
    expect(redisCommand).not.toHaveBeenCalled();
  });

  it("exchanges a one-time code using a short-lived developer-signed client secret and checks its subject", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id_token: await idToken(), refresh_token: "test-refresh-token" }), { status: 200 }));
    await expect(exchangeAppleAuthorizationCode("one-time-code", "apple-subject", { config, fetchImpl, keyResolver: async () => appleKeys.publicKey })).resolves.toBe("test-refresh-token");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://appleid.apple.com/auth/token");
    const body = new URLSearchParams(init?.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("one-time-code");
    expect(body.get("client_id")).toBe(config.clientId);
    const jwt = await jwtVerify(body.get("client_secret")!, signingKeys.publicKey, { issuer: config.teamId, audience: "https://appleid.apple.com" });
    expect(jwt.payload.sub).toBe(config.clientId);
    expect((jwt.payload.exp ?? 0) - (jwt.payload.iat ?? 0)).toBeLessThanOrEqual(300);
  });
  it("rejects an authorization code belonging to another Apple identity", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id_token: await idToken("different-subject"), refresh_token: "test-refresh-token" }), { status: 200 }));
    await expect(exchangeAppleAuthorizationCode("one-time-code", "apple-subject", { config, fetchImpl, keyResolver: async () => appleKeys.publicKey })).rejects.toThrow();
  });
  it("rejects a replayed code and a response without revocation material", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id_token: await idToken() }), { status: 200 }));
    const options = { config, fetchImpl, keyResolver: async () => appleKeys.publicKey };
    await expect(exchangeAppleAuthorizationCode("used-code", "apple-subject", options)).rejects.toThrow();
    await expect(exchangeAppleAuthorizationCode("new-code", "apple-subject", options)).rejects.toThrow();
  });
  it("encrypts revocation material and binds it to its account before sending it only to Apple", async () => {
    await storeAppleAuthorization({ id: accountId, identityKey: "a".repeat(64) }, "test-refresh-token", 100);
    const encrypted = redisCommand.mock.calls[0][0].at(-2) as string;
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toContain("test-refresh-token");
    redisCommand.mockResolvedValueOnce(encrypted);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    await revokeAppleAuthorization(accountId, { config, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    expect(new URLSearchParams(init?.body as string).get("token")).toBe("test-refresh-token");
    redisCommand.mockResolvedValueOnce(encrypted);
    await expect(revokeAppleAuthorization(otherAccount, { config, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("retains retryable authorization when Apple's revocation service is unavailable", async () => {
    await storeAppleAuthorization({ id: accountId, identityKey: "a".repeat(64) }, "test-refresh-token", 100);
    const encrypted = redisCommand.mock.calls[0][0].at(-2) as string;
    redisCommand.mockClear().mockResolvedValueOnce(encrypted);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(revokeAppleAuthorization(accountId, { config, fetchImpl })).rejects.toThrow();
    expect(redisCommand).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
