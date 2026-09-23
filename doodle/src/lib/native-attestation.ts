import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { PLAY_PACKAGE_NAME } from "@/lib/billing/play-config";
import { redisCommand } from "@/lib/redis";

const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";
const PLAY_INTEGRITY_API = "https://playintegrity.googleapis.com/v1";
const EXPECTED_PROJECT_ID = "doodle-506308";
const EXPECTED_CLIENT_EMAIL = "doodle-play-billing@doodle-506308.iam.gserviceaccount.com";
const CHALLENGE_TTL_SECONDS = 300;
const CHALLENGE_TTL_MILLISECONDS = CHALLENGE_TTL_SECONDS * 1000;
const TOKEN_PATTERN = /^\S{16,32768}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CERTIFICATE_DIGEST_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;
const PRINCIPAL_PATTERN = /^(?:account|trial|install):[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DELETE_CHALLENGE_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then\n" +
  "  return redis.call('DEL', KEYS[1])\n" +
  "end\n" +
  "return 0\n";

function logUnavailable(stage: string, error?: unknown) {
  const details: Record<string, string | number> = {
    event: "native_attestation_unavailable",
    stage,
  };
  if (error && typeof error === "object") {
    const value = error as {
      name?: unknown;
      code?: unknown;
      response?: unknown;
    };
    if (typeof value.name === "string") details.errorName = value.name.slice(0, 64);
    if (typeof value.code === "string" || typeof value.code === "number") {
      details.errorCode = String(value.code).slice(0, 64);
    }
    if (value.response && typeof value.response === "object") {
      const status = (value.response as { status?: unknown }).status;
      if (typeof status === "number" && Number.isInteger(status)) details.httpStatus = status;
    }
  }
  console.error("[native-attestation]", details);
}

export type NativeAttestationOperation = "guest" | "generate";

export type NativeAttestationConfig = {
  cloudProjectNumber: string;
  credentials: {
    type: "service_account";
    project_id: typeof EXPECTED_PROJECT_ID;
    client_email: string;
    private_key: string;
  };
  certificateDigests: readonly string[];
};

export type NativeChallenge = {
  challenge: string;
  requestHash: string;
  expiresAt: number;
};

type ChallengeRecord = {
  operation: NativeAttestationOperation;
  installId: string;
  sceneHash: string | null;
  principal: string;
  requestHash: string;
};

type DecodedIntegrityResponse = {
  tokenPayloadExternal?: unknown;
};

type IntegrityPayload = {
  testingDetails?: {
    isTestingResponse?: unknown;
  };
  requestDetails?: {
    requestPackageName?: unknown;
    requestHash?: unknown;
    timestampMillis?: unknown;
  };
  appIntegrity?: {
    appRecognitionVerdict?: unknown;
    packageName?: unknown;
    certificateSha256Digest?: unknown;
  };
  accountDetails?: {
    appLicensingVerdict?: unknown;
  };
  deviceIntegrity?: {
    deviceRecognitionVerdict?: unknown;
  };
};

export class NativeAttestationUnavailableError extends Error {
  constructor() {
    super("Native attestation is unavailable");
    this.name = "NativeAttestationUnavailableError";
  }
}

function configurationError(): never {
  throw new NativeAttestationUnavailableError();
}

function parseCredentials(value: unknown): NativeAttestationConfig["credentials"] {
  if (!value || typeof value !== "object") configurationError();
  const credentials = value as Partial<NativeAttestationConfig["credentials"]>;
  if (
    credentials.type !== "service_account" ||
    credentials.project_id !== EXPECTED_PROJECT_ID ||
    credentials.client_email !== EXPECTED_CLIENT_EMAIL ||
    typeof credentials.private_key !== "string" ||
    !credentials.private_key.startsWith("-----BEGIN PRIVATE KEY-----\n") ||
    !credentials.private_key.trimEnd().endsWith("-----END PRIVATE KEY-----")
  ) {
    configurationError();
  }
  return credentials as NativeAttestationConfig["credentials"];
}

function parseCredentialsEnv(name: "PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON" | "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") {
  let parsedCredentials: unknown;
  try {
    parsedCredentials = JSON.parse(process.env[name] ?? "");
  } catch {
    configurationError();
  }
  return parseCredentials(parsedCredentials);
}

function parseCertificateDigests(value: string | undefined) {
  const digests = (value ?? "")
    .split(",")
    .map((digest) => digest.trim())
    .filter(Boolean);
  if (
    digests.length === 0 ||
    digests.some((digest) => !CERTIFICATE_DIGEST_PATTERN.test(digest) || digest.includes(":"))
  ) {
    configurationError();
  }
  return digests;
}

export function getNativeAttestationConfig(): NativeAttestationConfig | null {
  if (process.env.NATIVE_ATTESTATION_ENABLED !== "true") return null;

  const cloudProjectNumber = process.env.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
  if (!cloudProjectNumber || !/^[0-9]{1,20}$/.test(cloudProjectNumber)) configurationError();

  const credentials = process.env.PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON !== undefined
    ? parseCredentialsEnv("PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON")
    : process.env.PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS === "true"
      ? parseCredentialsEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
      : configurationError();

  return {
    cloudProjectNumber,
    credentials,
    certificateDigests: parseCertificateDigests(process.env.PLAY_INTEGRITY_CERTIFICATE_SHA256),
  };
}

function normalizedInstallId(value: string) {
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function challengeKey(challenge: string) {
  return "doodle:native:attestation:" + createHash("sha256").update(challenge).digest("hex");
}

function stableRequestHash(record: {
  challenge: string;
  operation: NativeAttestationOperation;
  installId: string;
  sceneHash: string | null;
  principal: string;
}) {
  return createHash("sha256")
    .update(JSON.stringify(record))
    .digest("base64url");
}

function validOperation(value: unknown): value is NativeAttestationOperation {
  return value === "guest" || value === "generate";
}

function validSceneHash(value: string | null) {
  return value === null || SHA256_HEX_PATTERN.test(value);
}

export function nativePrincipal(kind: "account" | "trial" | "install", id: string) {
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid native principal");
  return kind + ":" + id.toLowerCase();
}

export function createNativeRequestHash(input: {
  challenge: string;
  operation: NativeAttestationOperation;
  installId: string;
  sceneHash: string | null;
  principal: string;
}) {
  return stableRequestHash({
    challenge: input.challenge,
    operation: input.operation,
    installId: input.installId,
    sceneHash: input.sceneHash,
    principal: input.principal,
  });
}

export async function createNativeChallenge(input: {
  operation: NativeAttestationOperation;
  installId: string;
  sceneHash: string | null;
  principal: string;
}): Promise<NativeChallenge> {
  if (!getNativeAttestationConfig()) throw new NativeAttestationUnavailableError();
  const install = normalizedInstallId(input.installId);
  if (
    !install ||
    !validOperation(input.operation) ||
    !validSceneHash(input.sceneHash) ||
    !PRINCIPAL_PATTERN.test(input.principal) ||
    (input.operation === "guest" && input.sceneHash !== null) ||
    (input.operation === "generate" && input.sceneHash === null) ||
    (input.operation === "guest" && !input.principal.toLowerCase().startsWith("install:")) ||
    (input.operation === "generate" && !/^(?:account|trial):/i.test(input.principal))
  ) {
    throw new Error("Invalid native attestation challenge");
  }

  const challenge = randomBytes(32).toString("base64url");
  const recordWithoutHash = {
    challenge,
    operation: input.operation,
    installId: install,
    sceneHash: input.sceneHash,
    principal: input.principal.toLowerCase(),
  };
  const requestHash = createNativeRequestHash(recordWithoutHash);
  const record: ChallengeRecord = {
    operation: input.operation,
    installId: install,
    sceneHash: input.sceneHash,
    principal: input.principal.toLowerCase(),
    requestHash,
  };
  const result = await redisCommand([
    "SET",
    challengeKey(challenge),
    JSON.stringify(record),
    "EX",
    CHALLENGE_TTL_SECONDS,
    "NX",
  ]);
  if (result !== "OK") throw new Error("Could not allocate native attestation challenge");
  return {
    challenge,
    requestHash,
    expiresAt: Date.now() + CHALLENGE_TTL_MILLISECONDS,
  };
}

function parsedChallenge(value: string): ChallengeRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Partial<ChallengeRecord>;
    if (
      !validOperation(record.operation) ||
      typeof record.installId !== "string" ||
      !UUID_PATTERN.test(record.installId) ||
      (record.sceneHash !== null && (typeof record.sceneHash !== "string" || !SHA256_HEX_PATTERN.test(record.sceneHash))) ||
      typeof record.principal !== "string" ||
      !PRINCIPAL_PATTERN.test(record.principal) ||
      typeof record.requestHash !== "string" ||
      !CHALLENGE_PATTERN.test(record.requestHash)
    ) {
      return null;
    }
    return {
      operation: record.operation,
      installId: record.installId.toLowerCase(),
      sceneHash: record.sceneHash,
      principal: record.principal.toLowerCase(),
      requestHash: record.requestHash,
    };
  } catch {
    return null;
  }
}

async function decodeIntegrityToken(
  token: string,
  config: NativeAttestationConfig,
  expectedRequestHash: string,
): Promise<"verified" | "invalid" | "unavailable"> {
  if (!TOKEN_PATTERN.test(token)) return "invalid";

  let client: Awaited<ReturnType<GoogleAuth["getClient"]>>;
  try {
    const auth = new GoogleAuth({
      credentials: config.credentials,
      scopes: [PLAY_INTEGRITY_SCOPE],
    });
    client = await auth.getClient();
  } catch (error) {
    logUnavailable("google_auth", error);
    return "unavailable";
  }

  let response: { data: DecodedIntegrityResponse; status?: number };
  try {
    response = await client.request<DecodedIntegrityResponse>({
      method: "POST",
      timeout: 15_000,
      url: PLAY_INTEGRITY_API + "/" + encodeURIComponent(PLAY_PACKAGE_NAME) + ":decodeIntegrityToken",
      data: { integrity_token: token },
    });
  } catch (error) {
    logUnavailable("google_decode_request", error);
    return "unavailable";
  }

  const tokenPayloadExternal = response.data?.tokenPayloadExternal;
  if (!tokenPayloadExternal || typeof tokenPayloadExternal !== "object" || Array.isArray(tokenPayloadExternal)) {
    logUnavailable("google_decode_response", response.status === undefined ? undefined : { response: { status: response.status } });
    return "unavailable";
  }

  const payload = tokenPayloadExternal as IntegrityPayload;

  const requestDetails = payload.requestDetails;
  const appIntegrity = payload.appIntegrity;
  const accountDetails = payload.accountDetails;
  const deviceIntegrity = payload.deviceIntegrity;
  const timestamp = typeof requestDetails?.timestampMillis === "string"
    ? Number(requestDetails.timestampMillis)
    : typeof requestDetails?.timestampMillis === "number"
      ? requestDetails.timestampMillis
      : NaN;
  const age = Date.now() - timestamp;
  const certificateDigests = Array.isArray(appIntegrity?.certificateSha256Digest)
    ? appIntegrity.certificateSha256Digest.filter((value): value is string => typeof value === "string")
    : [];
  const deviceVerdicts = Array.isArray(deviceIntegrity?.deviceRecognitionVerdict)
    ? deviceIntegrity.deviceRecognitionVerdict
    : [];

  const checks = {
    requestPackage: requestDetails?.requestPackageName === PLAY_PACKAGE_NAME,
    requestHash: requestDetails?.requestHash === expectedRequestHash,
    timestamp: Number.isSafeInteger(timestamp) && age >= -60_000 && age <= CHALLENGE_TTL_MILLISECONDS,
    appRecognition: appIntegrity?.appRecognitionVerdict === "PLAY_RECOGNIZED",
    appPackage: appIntegrity?.packageName === PLAY_PACKAGE_NAME,
    certificate: config.certificateDigests.some((digest) => certificateDigests.includes(digest)),
    licensed: accountDetails?.appLicensingVerdict === "LICENSED",
    deviceIntegrity: deviceVerdicts.includes("MEETS_DEVICE_INTEGRITY"),
  };
  const testingResponse = payload.testingDetails?.isTestingResponse === true;
  const valid = Object.values(checks).every(Boolean);
  if (!valid) {
    console.error("[native-attestation]", {
      event: "native_attestation_invalid",
      testingResponse,
      checks,
    });
  }

  return valid ? "verified" : "invalid";
}

async function deleteChallenge(challenge: string, stored: string) {
  const result = await redisCommand([
    "EVAL",
    DELETE_CHALLENGE_SCRIPT,
    "1",
    challengeKey(challenge),
    stored,
  ]);
  return result === 1 || result === "1";
}

export async function consumeNativeAttestation(input: {
  operation: NativeAttestationOperation;
  installId: string;
  sceneHash: string | null;
  principal: string;
  challenge: string;
  integrityToken: string;
}): Promise<"verified" | "unavailable" | "invalid"> {
  let config: NativeAttestationConfig | null;
  try {
    config = getNativeAttestationConfig();
  } catch (error) {
    logUnavailable("config", error);
    throw error;
  }
  if (!config) return "unavailable";
  const install = normalizedInstallId(input.installId);
  if (
    !install ||
    !validOperation(input.operation) ||
    !validSceneHash(input.sceneHash) ||
    !PRINCIPAL_PATTERN.test(input.principal) ||
    !CHALLENGE_PATTERN.test(input.challenge) ||
    !TOKEN_PATTERN.test(input.integrityToken)
  ) {
    return "invalid";
  }

  let storedValue: unknown;
  try {
    storedValue = await redisCommand(["GET", challengeKey(input.challenge)]);
  } catch (error) {
    logUnavailable("redis_get", error);
    throw error;
  }
  if (typeof storedValue !== "string") return "invalid";
  const record = parsedChallenge(storedValue);
  if (
    !record ||
    record.operation !== input.operation ||
    record.installId !== install ||
    record.sceneHash !== input.sceneHash ||
    record.principal !== input.principal.toLowerCase() ||
    record.requestHash !== createNativeRequestHash({
      challenge: input.challenge,
      operation: input.operation,
      installId: install,
      sceneHash: input.sceneHash,
      principal: input.principal.toLowerCase(),
    })
  ) {
    return "invalid";
  }

  const verdict = await decodeIntegrityToken(input.integrityToken, config, record.requestHash);
  if (verdict === "unavailable") return verdict;
  let deleted: boolean;
  try {
    deleted = await deleteChallenge(input.challenge, storedValue);
  } catch (error) {
    logUnavailable("redis_delete", error);
    throw error;
  }
  if (!deleted) return "invalid";
  return verdict;
}
