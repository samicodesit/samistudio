import { createHash, generateKeyPairSync, sign } from "node:crypto";
import cbor from "cbor";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { isolatedRedis } from "./test-utils/isolated-redis";
import { createAppleChallenge, registerAppleKey, consumeAppleAssertion, getAppleAttestationConfig } from "./apple-attestation";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ redis: vi.fn(), key: vi.fn(), receipt: vi.fn() }));
vi.mock("./redis", () => ({ redisCommand: mocks.redis }));
vi.mock("./apple-attestation-crypto", async original => ({ ...await original<typeof import("./apple-attestation-crypto")>(), verifyAppleKey: mocks.key, verifyAppleReceipt: mocks.receipt }));
const database = isolatedRedis();
const installId = "11111111-1111-4111-8111-111111111111", principal = "account:22222222-2222-4222-8222-222222222222";
const keyId = Buffer.alloc(32, 1).toString("base64"), pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const input = { operation: "generate" as const, installId, principal, sceneHash: "a".repeat(64) };
beforeAll(async () => { await database.start(); mocks.redis.mockImplementation(database.command); });
afterAll(async () => { await database.stop(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  mocks.redis.mockImplementation(database.command);
  await database.command(["FLUSHDB"]); vi.stubEnv("APPLE_APP_ATTEST_ENABLED", "true"); vi.stubEnv("APPLE_TEAM_ID", "8QN97U5U42"); vi.stubEnv("APPLE_SIGN_IN_CLIENT_ID", "nl.samistudio.doodle"); vi.stubEnv("APPLE_APP_ATTEST_ENVIRONMENT", "production"); vi.stubEnv("APPLE_APP_ATTEST_BUILDS", "1");
  mocks.key.mockReset().mockReturnValue({ keyId, publicKey: pair.publicKey.export({ type: "spki", format: "pem" }).toString(), receipt: "verified-receipt", environment: "production" }); mocks.receipt.mockReset().mockResolvedValue(undefined);
  await database.command(["SET", "doodle:account:22222222-2222-4222-8222-222222222222:active", "1"]);
});
async function registered() {
  const challenge = await createAppleChallenge(input);
  const payload = { ...input, challenge: challenge.challenge, keyId, attestation: "Apple attestation" };
  await registerAppleKey(payload);
  return payload;
}
function proof(payload: string, counter = 1) {
  const auth = Buffer.alloc(37); createHash("sha256").update("8QN97U5U42.nl.samistudio.doodle").digest().copy(auth); auth.writeUInt32BE(counter, 33);
  const nonce = createHash("sha256").update(Buffer.concat([auth, createHash("sha256").update(payload).digest()])).digest();
  return cbor.encode({ signature: sign("sha256", nonce, pair.privateKey), authenticatorData: auth }).toString("base64");
}
async function request(counter = 1) {
  const challenge = await createAppleChallenge(input);
  return { ...input, challenge: challenge.challenge, keyId, assertion: proof(challenge.requestHash, counter) };
}
it("fails closed when Apple attestation is disabled or misconfigured", async () => {
  vi.stubEnv("APPLE_APP_ATTEST_ENABLED", "false"); expect(getAppleAttestationConfig()).toBeNull(); await expect(createAppleChallenge(input)).rejects.toThrow();
  vi.stubEnv("APPLE_APP_ATTEST_ENABLED", "true"); vi.stubEnv("APPLE_TEAM_ID", "other"); expect(() => getAppleAttestationConfig()).toThrow();
});
it("consumes registration challenge once and indexes the key for account deletion", async () => {
  const payload = await registered(); await expect(registerAppleKey(payload)).resolves.toEqual({ registered: true });
  expect(await database.command(["SCARD", "doodle:account:22222222-2222-4222-8222-222222222222:apple-attest-keys"])).toBe(1);
  expect(await consumeAppleAssertion({ ...payload, assertion: proof("wrong") })).toBe("invalid");
});
it("rejects registration when independent receipt verification fails", async () => {
  mocks.receipt.mockRejectedValue(new Error("forged receipt")); const challenge = await createAppleChallenge(input);
  await expect(registerAppleKey({ ...input, challenge: challenge.challenge, keyId, attestation: "bad" })).rejects.toThrow();
  expect(await database.command(["SCARD", "doodle:account:22222222-2222-4222-8222-222222222222:apple-attest-keys"])).toBe(0);
});
it("rejects a foreign principal and modified photo or detail without consuming the legitimate request", async () => {
  await registered(); const r = await request();
  for (const change of [{ principal: "account:33333333-3333-4333-8333-333333333333" }, { sceneHash: "b".repeat(64) }, { detailLevel: "detailed" as const }, { installId: "44444444-4444-4444-8444-444444444444" }]) expect(await consumeAppleAssertion({ ...r, ...change })).toBe("invalid");
  expect(await consumeAppleAssertion(r)).toBe("verified"); expect(await consumeAppleAssertion(r)).toBe("invalid");
});
it("allows exactly one concurrent consumption of the same proof", async () => {
  await registered(); const r = await request(); const results = await Promise.all([consumeAppleAssertion(r), consumeAppleAssertion(r)]);
  expect(results.sort()).toEqual(["invalid", "verified"]);
});
it("atomically advances assertion counters and rejects out-of-order proofs", async () => {
  await registered(); const low = await request(1), high = await request(2);
  expect(await consumeAppleAssertion(high)).toBe("verified"); expect(await consumeAppleAssertion(low)).toBe("invalid");
  expect(await consumeAppleAssertion(await request(3))).toBe("verified");
});
it("cannot rebind a hardware key to another account or environment", async () => {
  await registered(); const foreign = { ...input, principal: "account:33333333-3333-4333-8333-333333333333" };
  await database.command(["SET", "doodle:account:33333333-3333-4333-8333-333333333333:active", "1"]);
  const challenge = await createAppleChallenge(foreign); await expect(registerAppleKey({ ...foreign, challenge: challenge.challenge, keyId, attestation: "Apple attestation" })).rejects.toThrow();
  vi.stubEnv("APPLE_APP_ATTEST_ENVIRONMENT", "development"); const changed = await createAppleChallenge(input);
  expect(await consumeAppleAssertion({ ...input, challenge: changed.challenge, keyId, assertion: proof(changed.requestHash) })).toBe("invalid");
});
it("rejects deleted account registration and invalid expired challenges", async () => {
  const challenge = await createAppleChallenge(input); await database.command(["DEL", "doodle:account:22222222-2222-4222-8222-222222222222:active"]);
  await database.command(["SET", "doodle:account:22222222-2222-4222-8222-222222222222:deleted", "deleted"]);
  await expect(registerAppleKey({ ...input, challenge: challenge.challenge, keyId, attestation: "Apple attestation" })).rejects.toThrow();
  expect(await consumeAppleAssertion({ ...input, challenge: "z".repeat(43), keyId, assertion: proof("expired") })).toBe("invalid");
});
