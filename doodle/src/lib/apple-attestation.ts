import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { isDetailLevel, storedDetailLevel, type DetailLevel } from "./generation/detail-level";
import { createNativeRequestHash, NativeAttestationUnavailableError } from "./native-attestation";
import { redisCommand } from "./redis";
import { verifyAppleKey, verifyAppleReceipt, verifyAppleRequest, type AppleAttestVerificationConfig } from "./apple-attestation-crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE = /^[A-Za-z0-9_-]{43}$/;
const HASH = /^[a-f0-9]{64}$/;
const CHALLENGE_TTL = 300;
const KEY_TTL = 366 * 86400;
export class AppleAttestationInvalidError extends Error { constructor() { super("Invalid Apple attestation"); } }
export interface AppleAttestationInput {
  operation: "guest" | "generate";
  installId: string;
  principal: string;
  sceneHash: string | null;
  detailLevel?: DetailLevel;
}
interface ChallengeRecord extends AppleAttestationInput { requestHash: string }
interface KeyRecord { principal: string; installId: string; publicKey: string; receipt: string; environment: "production" | "development"; attestationHash: string; registrationChallenge: string }
const REGISTER = `
if ARGV[5] == '1' and (redis.call('GET', KEYS[4]) ~= '1' or redis.call('EXISTS', KEYS[5]) == 1) then return 0 end
local kind = redis.call('TYPE', KEYS[3]).ok
if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid Apple key index') end
local existing = redis.call('HGET', KEYS[2], 'record')
if existing then
  if existing == ARGV[2] then return 1 end
  return 0
end
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[2], 'record', ARGV[2], 'counter', '0')
redis.call('EXPIRE', KEYS[2], ARGV[3])
redis.call('SADD', KEYS[3], KEYS[2])
redis.call('EXPIRE', KEYS[3], ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`;
const CONSUME = `
if ARGV[5] == '1' and (redis.call('GET', KEYS[3]) ~= '1' or redis.call('EXISTS', KEYS[4]) == 1) then return 0 end
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('HGET', KEYS[2], 'record') ~= ARGV[2] then return 0 end
local counter = tonumber(redis.call('HGET', KEYS[2], 'counter'))
if not counter or counter >= tonumber(ARGV[3]) then return 0 end
redis.call('HSET', KEYS[2], 'counter', ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`;
function invalid(): never { throw new AppleAttestationInvalidError(); }
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function namespace(config: AppleAttestVerificationConfig): string { return `doodle:apple:attest:${config.environment}:`; }
function challengeKey(config: AppleAttestVerificationConfig, challenge: string): string { return `${namespace(config)}challenge:${hash(challenge)}`; }
function hardwareKey(config: AppleAttestVerificationConfig, id: string): string { return `${namespace(config)}key:${hash(id)}`; }
function validKey(id: string): boolean { return /^[A-Za-z0-9+/]{43}=$/.test(id) && Buffer.from(id, "base64").length === 32 && Buffer.from(id, "base64").toString("base64") === id; }
function normalized(input: AppleAttestationInput): AppleAttestationInput {
  const colon = typeof input.principal === "string" ? input.principal.indexOf(":") : -1;
  if (!UUID.test(input.installId) || colon < 0 || !UUID.test(input.principal.slice(colon + 1)) || (input.operation !== "guest" && input.operation !== "generate") || (input.detailLevel !== undefined && !isDetailLevel(input.detailLevel)) || (input.operation === "guest" && (input.sceneHash !== null || input.detailLevel !== undefined || input.principal.toLowerCase() !== `install:${input.installId.toLowerCase()}`)) || (input.operation === "generate" && (!/^(account|trial):/i.test(input.principal) || typeof input.sceneHash !== "string" || !HASH.test(input.sceneHash)))) invalid();
  return { operation: input.operation, installId: input.installId.toLowerCase(), principal: input.principal.toLowerCase(), sceneHash: input.sceneHash, ...(input.detailLevel && input.detailLevel !== "simple" ? { detailLevel: input.detailLevel } : {}) };
}
export function getAppleAttestationConfig(): AppleAttestVerificationConfig | null {
  if (process.env.APPLE_APP_ATTEST_ENABLED !== "true") return null;
  const teamIdentifier = process.env.APPLE_TEAM_ID ?? "", bundleIdentifier = process.env.APPLE_SIGN_IN_CLIENT_ID ?? "";
  const environment = process.env.APPLE_APP_ATTEST_ENVIRONMENT ?? "production";
  const allowedBuilds = (process.env.APPLE_APP_ATTEST_BUILDS ?? "1").split(",");
  if (!/^[A-Z0-9]{10}$/.test(teamIdentifier) || bundleIdentifier !== "nl.samistudio.doodle" || (environment !== "production" && environment !== "development") || !allowedBuilds.length || allowedBuilds.length > 10 || allowedBuilds.some(build => !/^[0-9]{1,10}$/.test(build))) throw new NativeAttestationUnavailableError();
  return { teamIdentifier, bundleIdentifier, environment, allowedBuilds };
}
function enabled(): AppleAttestVerificationConfig { const config = getAppleAttestationConfig(); if (!config) throw new NativeAttestationUnavailableError(); return config; }
function requestHash(config: AppleAttestVerificationConfig, input: AppleAttestationInput, challenge: string): string {
  return createHash("sha256").update(`apple:${config.environment}:${createNativeRequestHash({ ...input, challenge })}`).digest("base64url");
}
export async function createAppleChallenge(input: AppleAttestationInput): Promise<{ challenge: string; requestHash: string; expiresAt: number; keyScope: string }> {
  const config = enabled(), scope = normalized(input), challenge = randomBytes(32).toString("base64url");
  const record = { ...scope, requestHash: requestHash(config, scope, challenge) };
  if (await redisCommand(["SET", challengeKey(config, challenge), JSON.stringify(record), "EX", CHALLENGE_TTL, "NX"]) !== "OK") throw new NativeAttestationUnavailableError();
  return { challenge, requestHash: record.requestHash, expiresAt: Date.now() + CHALLENGE_TTL * 1000, keyScope: hash(`${config.environment}:${scope.principal}:${scope.installId}`) };
}
async function storedChallenge(config: AppleAttestVerificationConfig, challenge: string): Promise<{ raw: string; record: ChallengeRecord }> {
  if (!NONCE.test(challenge)) invalid();
  const raw = await redisCommand(["GET", challengeKey(config, challenge)]);
  if (typeof raw !== "string") invalid();
  let record: ChallengeRecord; try { record = JSON.parse(raw); } catch { invalid(); }
  const scope = normalized(record);
  if (record.requestHash !== requestHash(config, scope, challenge)) invalid();
  return { raw, record: { ...scope, requestHash: record.requestHash } };
}
async function readChallenge(config: AppleAttestVerificationConfig, input: AppleAttestationInput, challenge: string): Promise<string> {
  const { raw, record } = await storedChallenge(config, challenge);
  const expected = normalized(input);
  if (!record || record.operation !== expected.operation || record.installId !== expected.installId || record.principal !== expected.principal || record.sceneHash !== expected.sceneHash || storedDetailLevel(record.detailLevel) !== storedDetailLevel(expected.detailLevel) || record.requestHash !== requestHash(config, expected, challenge)) invalid();
  return raw;
}
function accountKeys(config: AppleAttestVerificationConfig, scope: Pick<AppleAttestationInput, "principal">): { active: string; deleted: string; index: string; account: boolean } {
  const account = scope.principal.startsWith("account:");
  const base = account ? `doodle:account:${scope.principal.slice(8)}:` : `${namespace(config)}principal:${hash(scope.principal)}:`;
  return { active: `${base}active`, deleted: `${base}deleted`, index: `${base}apple-attest-keys`, account };
}
function keyRecord(raw: unknown): KeyRecord {
  if (typeof raw !== "string") invalid();
  let value: KeyRecord; try { value = JSON.parse(raw); } catch { invalid(); }
  if (!value || typeof value.principal !== "string" || typeof value.installId !== "string" || typeof value.publicKey !== "string" || value.publicKey.length > 2048 || !value.publicKey.startsWith("-----BEGIN PUBLIC KEY-----") || typeof value.receipt !== "string" || value.receipt.length > 32_768 || (value.environment !== "development" && value.environment !== "production") || typeof value.attestationHash !== "string" || !HASH.test(value.attestationHash) || !NONCE.test(value.registrationChallenge)) invalid();
  return value;
}
export async function registerAppleKey(input: { principal: string; installId: string; keyId: string; challenge: string; attestation: string }): Promise<{ registered: true }> {
  const config = enabled();
  if (typeof input.principal !== "string" || !/^(account|trial|install):/i.test(input.principal) || !UUID.test(input.principal.slice(input.principal.indexOf(":") + 1)) || !UUID.test(input.installId)) invalid();
  const scope = { principal: input.principal.toLowerCase(), installId: input.installId.toLowerCase() };
  if (!validKey(input.keyId) || !NONCE.test(input.challenge) || typeof input.attestation !== "string" || !input.attestation || input.attestation.length > 32_768) invalid();
  const key = hardwareKey(config, input.keyId), existing = await redisCommand(["HGET", key, "record"]), account = accountKeys(config, scope);
  let stored: string, challengeValue = "";
  if (existing !== null) {
    const record = keyRecord(existing);
    if (record.principal !== scope.principal || record.installId !== scope.installId || record.environment !== config.environment || record.attestationHash !== hash(input.attestation) || record.registrationChallenge !== input.challenge) invalid();
    stored = existing as string;
  } else {
    const challenge = await storedChallenge(config, input.challenge);
    if (challenge.record.principal !== scope.principal || challenge.record.installId !== scope.installId) invalid();
    challengeValue = challenge.raw;
    const payload = challenge.record.requestHash;
    let verified: ReturnType<typeof verifyAppleKey>;
    try { verified = verifyAppleKey({ attestation: input.attestation, keyId: input.keyId, payload }, config); await verifyAppleReceipt({ receipt: verified.receipt, publicKey: verified.publicKey, payload }, config); } catch { invalid(); }
    if (verified.keyId !== input.keyId || verified.environment !== config.environment) invalid();
    stored = JSON.stringify({ principal: scope.principal, installId: scope.installId, publicKey: verified.publicKey, receipt: verified.receipt, environment: verified.environment, attestationHash: hash(input.attestation), registrationChallenge: input.challenge } satisfies KeyRecord);
  }
  const result = await redisCommand(["EVAL", REGISTER, "5", challengeKey(config, input.challenge), key, account.index, account.active, account.deleted, challengeValue, stored, KEY_TTL, scope.principal, account.account ? "1" : "0"]);
  if (result !== 1) invalid();
  return { registered: true };
}
export async function consumeAppleAssertion(input: AppleAttestationInput & { keyId: string; challenge: string; assertion: string }): Promise<"verified" | "invalid" | "unavailable"> {
  const config = getAppleAttestationConfig(); if (!config) return "unavailable";
  let scope: AppleAttestationInput, rawChallenge: string;
  try { scope = normalized(input); if (!validKey(input.keyId)) invalid(); rawChallenge = await readChallenge(config, scope, input.challenge); } catch (error) { if (error instanceof AppleAttestationInvalidError) return "invalid"; throw error; }
  const key = hardwareKey(config, input.keyId), rawKey = await redisCommand(["HGET", key, "record"]), counter = await redisCommand(["HGET", key, "counter"]);
  let verifiedCounter: number;
  try {
    const record = keyRecord(rawKey);
    if (record.principal !== scope.principal || record.installId !== scope.installId || record.environment !== config.environment || typeof counter !== "string" || !/^(0|[1-9][0-9]*)$/.test(counter)) invalid();
    verifiedCounter = verifyAppleRequest({ assertion: input.assertion, payload: requestHash(config, scope, input.challenge), publicKey: record.publicKey, signCount: Number(counter) }, config).signCount;
  } catch { return "invalid"; }
  const account = accountKeys(config, scope);
  const result = await redisCommand(["EVAL", CONSUME, "4", challengeKey(config, input.challenge), key, account.active, account.deleted, rawChallenge, rawKey, verifiedCounter, KEY_TTL, account.account ? "1" : "0"]);
  return result === 1 ? "verified" : "invalid";
}
