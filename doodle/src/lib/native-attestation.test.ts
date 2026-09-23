import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeNativeAttestation,
  createNativeChallenge,
  createNativeRequestHash,
  getNativeAttestationConfig,
  nativePrincipal,
} from "./native-attestation";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  redisCommand: vi.fn(),
  GoogleAuth: vi.fn(),
  getClient: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.redisCommand }));
vi.mock("google-auth-library", () => ({ GoogleAuth: mocks.GoogleAuth }));

const installId = "11111111-1111-4111-8111-111111111111";
const accountPrincipal = nativePrincipal("account", installId);
const certificateDigest = "A".repeat(32);
const credentials = {
  type: "service_account" as const,
  project_id: "doodle-506308" as const,
  client_email: "doodle-play-billing@doodle-506308.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n",
};

function enabledBaseEnv() {
  vi.stubEnv("NATIVE_ATTESTATION_ENABLED", "true");
  vi.stubEnv("PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER", "368967912119");
  vi.stubEnv("PLAY_INTEGRITY_CERTIFICATE_SHA256", certificateDigest);
}

function enabledEnv() {
  enabledBaseEnv();
  vi.stubEnv("PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON", JSON.stringify(credentials));
}

function enabledBillingCredentialEnv() {
  enabledBaseEnv();
  vi.stubEnv("PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS", "true");
  vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", JSON.stringify(credentials));
}

function validPayload(requestHash: string, overrides: Record<string, unknown> = {}) {
  return {
    requestDetails: {
      requestPackageName: "nl.samistudio.doodle",
      requestHash,
      timestampMillis: String(Date.now()),
    },
    appIntegrity: {
      appRecognitionVerdict: "PLAY_RECOGNIZED",
      packageName: "nl.samistudio.doodle",
      certificateSha256Digest: [certificateDigest],
    },
    accountDetails: { appLicensingVerdict: "LICENSED" },
    deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] },
    ...overrides,
  };
}

describe("native Integrity configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.redisCommand.mockReset();
    mocks.GoogleAuth.mockReset();
    mocks.getClient.mockReset();
    mocks.request.mockReset();
  });

  it("stays disabled until the explicit flag is enabled", () => {
    expect(getNativeAttestationConfig()).toBeNull();
  });

  it("requires dedicated service credentials and a base64 certificate digest", () => {
    enabledEnv();
    expect(getNativeAttestationConfig()).toMatchObject({
      cloudProjectNumber: "368967912119",
      credentials,
      certificateDigests: [certificateDigest],
    });

    vi.stubEnv("PLAY_INTEGRITY_CERTIFICATE_SHA256", "BD:31:BE:25:A8:57");
    expect(() => getNativeAttestationConfig()).toThrow("Native attestation is unavailable");
  });

  it("accepts the URL-safe certificate digest returned by Play Integrity", () => {
    enabledEnv();
    const digest = "vTG-JahXPGXgAgau5MpHK1m_pArNJXKJ6kk5WISRPmQ";
    vi.stubEnv("PLAY_INTEGRITY_CERTIFICATE_SHA256", digest);
    expect(getNativeAttestationConfig()).toMatchObject({ certificateDigests: [digest] });
  });

  it("rejects a standard base64 certificate digest", () => {
    enabledEnv();
    vi.stubEnv("PLAY_INTEGRITY_CERTIFICATE_SHA256", "vTG+JahXPGXgAgau5MpHK1m/pArNJXKJ6kk5WISRPmQ=");
    expect(() => getNativeAttestationConfig()).toThrow("Native attestation is unavailable");
  });

  it("allows explicit reuse of the matching Play billing credential", () => {
    enabledBillingCredentialEnv();

    expect(getNativeAttestationConfig()).toMatchObject({ credentials });
  });

  it("rejects billing credential reuse unless project and account match exactly", () => {
    enabledBaseEnv();
    vi.stubEnv("PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS", "true");
    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", JSON.stringify({ ...credentials, project_id: "other-project" }));
    expect(() => getNativeAttestationConfig()).toThrow("Native attestation is unavailable");

    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", JSON.stringify({ ...credentials, client_email: "other@example.com" }));
    expect(() => getNativeAttestationConfig()).toThrow("Native attestation is unavailable");
  });

  it("does not silently reuse the Play billing credential without explicit opt-in", () => {
    enabledBaseEnv();
    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", JSON.stringify(credentials));

    expect(() => getNativeAttestationConfig()).toThrow("Native attestation is unavailable");
  });

  it("fails closed when enabled configuration is incomplete", () => {
    vi.stubEnv("NATIVE_ATTESTATION_ENABLED", "true");
    expect(() => getNativeAttestationConfig()).toThrow("Native attestation is unavailable");
  });
});

describe("native Integrity challenges", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    enabledEnv();
    mocks.redisCommand.mockReset();
    mocks.redisCommand.mockResolvedValue("OK");
    mocks.GoogleAuth.mockReset();
    mocks.getClient.mockReset();
    mocks.request.mockReset();
  });

  it("stores a five-minute, request-bound guest challenge", async () => {
    const before = Date.now();
    const result = await createNativeChallenge({
      operation: "guest",
      installId: installId.toUpperCase(),
      sceneHash: null,
      principal: nativePrincipal("install", installId),
    });
    expect(result.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.requestHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 299_000);
    expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 301_000);
    expect(mocks.redisCommand).toHaveBeenCalledWith([
      "SET",
      expect.stringMatching(/^doodle:native:attestation:[a-f0-9]{64}$/),
      expect.stringContaining('"operation":"guest"'),
      "EX",
      300,
      "NX",
    ]);
  });

  it("rejects a guest scene hash and a generate request without a scene hash", async () => {
    await expect(createNativeChallenge({
      operation: "guest",
      installId,
      sceneHash: "a".repeat(64),
      principal: nativePrincipal("install", installId),
    })).rejects.toThrow("Invalid native attestation challenge");
    await expect(createNativeChallenge({
      operation: "generate",
      installId,
      sceneHash: null,
      principal: accountPrincipal,
    })).rejects.toThrow("Invalid native attestation challenge");
  });

  it("accepts one valid decoded verdict and deletes the challenge atomically", async () => {
    const challenge = "b".repeat(43);
    const sceneHash = "c".repeat(64);
    const requestHash = createNativeRequestHash({
      challenge,
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
    });
    const stored = JSON.stringify({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      requestHash,
    });
    mocks.redisCommand.mockResolvedValueOnce(stored).mockResolvedValueOnce(1);
    mocks.request.mockResolvedValue({
      data: { tokenPayloadExternal: validPayload(requestHash) },
    });
    mocks.getClient.mockResolvedValue({ request: mocks.request });
    mocks.GoogleAuth.mockImplementation(() => ({ getClient: mocks.getClient }));

    await expect(consumeNativeAttestation({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      challenge,
      integrityToken: "t".repeat(16),
    })).resolves.toBe("verified");
    expect(mocks.GoogleAuth).toHaveBeenCalledWith({
      credentials,
      scopes: ["https://www.googleapis.com/auth/playintegrity"],
    });
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      timeout: 15_000,
      url: "https://playintegrity.googleapis.com/v1/nl.samistudio.doodle:decodeIntegrityToken",
      data: { integrity_token: "t".repeat(16) },
    }));
    expect(mocks.redisCommand).toHaveBeenLastCalledWith([
      "EVAL",
      expect.stringContaining("redis.call('GET'"),
      "1",
      expect.stringMatching(/^doodle:native:attestation:[a-f0-9]{64}$/),
      stored,
    ]);
  });

  it("rejects a wrong request hash and a replayed challenge", async () => {
    const challenge = "d".repeat(43);
    const sceneHash = "e".repeat(64);
    const requestHash = createNativeRequestHash({
      challenge,
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
    });
    const stored = JSON.stringify({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      requestHash,
    });
    mocks.redisCommand.mockResolvedValueOnce(stored).mockResolvedValueOnce(1);
    mocks.request.mockResolvedValue({
      data: { tokenPayloadExternal: validPayload("f".repeat(43)) },
    });
    mocks.getClient.mockResolvedValue({ request: mocks.request });
    mocks.GoogleAuth.mockImplementation(() => ({ getClient: mocks.getClient }));
    await expect(consumeNativeAttestation({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      challenge,
      integrityToken: "t".repeat(16),
    })).resolves.toBe("invalid");
    expect(mocks.redisCommand).toHaveBeenCalledTimes(2);

    mocks.redisCommand.mockReset();
    mocks.redisCommand.mockResolvedValueOnce(stored).mockResolvedValueOnce(0);
    mocks.request.mockResolvedValue({
      data: { tokenPayloadExternal: validPayload(requestHash) },
    });
    await expect(consumeNativeAttestation({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      challenge,
      integrityToken: "t".repeat(16),
    })).resolves.toBe("invalid");
  });

  it("rejects wrong app, license, device, and stale verdicts", async () => {
    const challenge = "g".repeat(43);
    const sceneHash = "h".repeat(64);
    const requestHash = createNativeRequestHash({
      challenge,
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
    });
    const stored = JSON.stringify({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      requestHash,
    });
    mocks.getClient.mockResolvedValue({ request: mocks.request });
    mocks.GoogleAuth.mockImplementation(() => ({ getClient: mocks.getClient }));

    for (const override of [
      { requestDetails: { requestPackageName: "other", requestHash, timestampMillis: String(Date.now()) } },
      { accountDetails: { appLicensingVerdict: "UNLICENSED" } },
      { deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_BASIC_INTEGRITY"] } },
      { requestDetails: { requestPackageName: "nl.samistudio.doodle", requestHash, timestampMillis: "1" } },
    ]) {
      mocks.redisCommand.mockReset();
      mocks.redisCommand.mockResolvedValueOnce(stored).mockResolvedValueOnce(1);
      mocks.request.mockResolvedValue({
        data: { tokenPayloadExternal: validPayload(requestHash, override) },
      });
      await expect(consumeNativeAttestation({
      operation: "generate",
      installId,
      sceneHash,
      principal: accountPrincipal,
      challenge,
        integrityToken: "t".repeat(16),
      })).resolves.toBe("invalid");
    }
  });
});
