import { createHash, generateKeyPairSync, sign } from "node:crypto";
import cbor from "cbor";
import { describe, expect, it, vi } from "vitest";
import development from "./test-fixtures/app-attest/attestation-development.json";
import production from "./test-fixtures/app-attest/attestation-production.json";
import { verifyAppleKey, verifyAppleRequest, verifyAppleReceipt } from "./apple-attestation-crypto";
vi.mock("server-only", () => ({}));
const fixtureConfig = { teamIdentifier: "V8H6LQ9448", bundleIdentifier: "io.uebelacker.AppAttestExample", environment: "production" as const, allowedBuilds: ["1"], now: Date.parse("2024-03-01T00:00:00Z") };
const fixtureInput = { attestation: production.attestation, keyId: production.keyId, payload: Buffer.from(production.challenge, "base64") };
const config = { teamIdentifier: "8QN97U5U42", bundleIdentifier: "nl.samistudio.doodle", environment: "production" as const, allowedBuilds: ["1"] };
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
function assertion(payload = "server challenge", count = 1, appId = "8QN97U5U42.nl.samistudio.doodle", extensions?: unknown) {
  const data = Buffer.alloc(37); createHash("sha256").update(appId).digest().copy(data); data[32] = extensions ? 128 : 0; data.writeUInt32BE(count, 33);
  const auth = extensions ? Buffer.concat([data, cbor.encode(extensions)]) : data;
  const nonce = createHash("sha256").update(Buffer.concat([auth, createHash("sha256").update(payload).digest()])).digest();
  return cbor.encode({ signature: sign("sha256", nonce, pair.privateKey), authenticatorData: auth }).toString("base64");
}
describe("Apple attestation verification", () => {
  it("accepts an Apple-signed production attestation during its certificate validity", () => {
    expect(verifyAppleKey(fixtureInput, fixtureConfig)).toMatchObject({ keyId: production.keyId, environment: "production" });
  });
  it("rejects expired Apple leaf certificates", () => {
    expect(() => verifyAppleKey(fixtureInput, { ...fixtureConfig, now: Date.parse("2026-10-13T00:00:00Z") })).toThrow();
  });
  it("keeps development and production keys separate", () => {
    const input = { attestation: development.attestation, keyId: development.keyId, payload: Buffer.from(development.challenge, "base64") };
    expect(() => verifyAppleKey(input, fixtureConfig)).toThrow();
    expect(verifyAppleKey(input, { ...fixtureConfig, environment: "development" })).toMatchObject({ environment: "development" });
    expect(() => verifyAppleKey(fixtureInput, { ...fixtureConfig, environment: "development" })).toThrow();
  });
  it.each(["team", "bundle", "challenge", "key"])("rejects an attestation with altered %s", field => {
    const input = { ...fixtureInput, ...(field === "challenge" ? { payload: "wrong challenge" } : {}), ...(field === "key" ? { keyId: Buffer.alloc(32).toString("base64") } : {}) };
    const options = { ...fixtureConfig, ...(field === "team" ? { teamIdentifier: "8QN97U5U42" } : {}), ...(field === "bundle" ? { bundleIdentifier: "nl.samistudio.doodle" } : {}) };
    expect(() => verifyAppleKey(input, options)).toThrow();
  });
  it("verifies a signed request and returns its next counter", () => {
    expect(verifyAppleRequest({ assertion: assertion(), payload: "server challenge", publicKey, signCount: 0 }, config)).toEqual({ signCount: 1 });
  });
  it.each(["photo", "detail", "challenge", "principal"])("rejects a signature when bound %s changes", field => {
    expect(() => verifyAppleRequest({ assertion: assertion(), payload: "changed " + field, publicKey, signCount: 0 }, config)).toThrow();
  });
  it("rejects foreign app and key signatures", () => {
    expect(() => verifyAppleRequest({ assertion: assertion("server challenge", 1, "wrong.app"), payload: "server challenge", publicKey, signCount: 0 }, config)).toThrow();
    const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    expect(() => verifyAppleRequest({ assertion: assertion(), payload: "server challenge", publicKey: other.publicKey.export({ type: "spki", format: "pem" }).toString(), signCount: 0 }, config)).toThrow();
  });
  it.each([0, 1, 2])("rejects non-increasing counter %s", count => {
    expect(() => verifyAppleRequest({ assertion: assertion("server challenge", count), payload: "server challenge", publicKey, signCount: 2 }, config)).toThrow();
  });
  it("rejects concatenated CBOR and malformed base64", () => {
    expect(() => verifyAppleRequest({ assertion: Buffer.concat([Buffer.from(assertion(), "base64"), cbor.encode({})]).toString("base64"), payload: "server challenge", publicKey, signCount: 0 }, config)).toThrow();
    expect(() => verifyAppleRequest({ assertion: "!!!!!", payload: "server challenge", publicKey, signCount: 0 }, config)).toThrow();
  });
  it("validates signed build and distribution extensions when present", () => {
    const good = { apple_validation_category_01: 4, apple_bundle_version_01: "1" };
    expect(verifyAppleRequest({ assertion: assertion("server challenge", 1, undefined, good), payload: "server challenge", publicKey, signCount: 0 }, config)).toEqual({ signCount: 1 });
    for (const bad of [{ ...good, apple_validation_category_01: 0 }, { ...good, apple_bundle_version_01: "999" }, { apple_bundle_version_01: "1" }]) {
      expect(() => verifyAppleRequest({ assertion: assertion("server challenge", 1, undefined, bad), payload: "server challenge", publicKey, signCount: 0 }, config)).toThrow();
    }
  });
  it("accepts Apple's four-byte little-endian signing category and rejects malformed values", () => {
    const good = { apple_validation_category_01: Buffer.from([4, 0, 0, 0]), apple_bundle_version_01: "1" };
    expect(verifyAppleRequest({ assertion: assertion("server challenge", 1, undefined, good), payload: "server challenge", publicKey, signCount: 0 }, config)).toEqual({ signCount: 1 });
    for (const category of [Buffer.from([4]), Buffer.from([0, 0, 0, 4]), Buffer.from([3, 0, 0, 0])]) {
      expect(() => verifyAppleRequest({ assertion: assertion("server challenge", 1, undefined, { ...good, apple_validation_category_01: category }), payload: "server challenge", publicKey, signCount: 0 }, config)).toThrow();
    }
  });
});

describe("independent Apple attestation receipt validation", () => {
  const receiptConfig = { ...fixtureConfig, now: Date.parse("2024-02-07T21:09:00Z") };
  const key = () => verifyAppleKey(fixtureInput, fixtureConfig);
  it("verifies the Apple-signed receipt, its app identity, public key and creation time", async () => {
    await expect(verifyAppleReceipt({ receipt: key().receipt, publicKey: key().publicKey, payload: fixtureInput.payload }, receiptConfig)).resolves.toBeUndefined();
  });
  it.each(["app", "key", "time", "environment", "challenge"])("rejects receipt with wrong %s binding", async field => {
    const input = { receipt: key().receipt, publicKey: key().publicKey, payload: fixtureInput.payload };
    if (field === "key") input.publicKey = publicKey;
    if (field === "challenge") input.payload = Buffer.from("wrong challenge");
    const options = { ...receiptConfig, ...(field === "app" ? { bundleIdentifier: "wrong.app" } : {}), ...(field === "time" ? { now: Date.parse("2024-02-07T22:00:00Z") } : {}), ...(field === "environment" ? { environment: "development" as const } : {}) };
    await expect(verifyAppleReceipt(input, options)).rejects.toThrow();
  });
  it("rejects a tampered CMS signature", async () => {
    const bytes = Buffer.from(key().receipt, "base64"); bytes[bytes.length - 20] ^= 1;
    await expect(verifyAppleReceipt({ receipt: bytes.toString("base64"), publicKey: key().publicKey, payload: fixtureInput.payload }, receiptConfig)).rejects.toThrow();
  });
});
