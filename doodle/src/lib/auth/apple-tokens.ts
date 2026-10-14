import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { required } from "@/lib/env";
import { redisCommand } from "@/lib/redis";
import { appleClientId, verifyAppleCodeIdentity, type AppleVerificationOptions } from "./apple";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORE_AUTHORIZATION = `
if redis.call('GET', KEYS[1]) ~= '1' or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
if redis.call('HGET', KEYS[4], 'deleted') == '1' or tonumber(ARGV[2]) <= tonumber(redis.call('HGET', KEYS[4], 'revokedAt') or '-1') then return 0 end
local latest = tonumber(redis.call('GET', KEYS[5]) or '-1')
if tonumber(ARGV[2]) < latest then return 0 end
redis.call('SET', KEYS[3], ARGV[1])
redis.call('SET', KEYS[5], ARGV[2])
redis.call('DEL', KEYS[6])
return 1
`;

export interface AppleSignInConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}
export type AppleTokenOptions = AppleVerificationOptions & { config?: AppleSignInConfig; fetchImpl?: typeof fetch };

export class AppleAuthorizationError extends Error {
  constructor(readonly kind: "invalid" | "unavailable") {
    super(kind === "invalid" ? "Invalid Apple credential" : "Apple authorization unavailable");
  }
}

export function getAppleSignInConfig(): AppleSignInConfig {
  const config = {
    clientId: appleClientId(),
    teamId: process.env.APPLE_TEAM_ID?.trim() || "",
    keyId: process.env.APPLE_SIGN_IN_KEY_ID?.trim() || "",
    privateKey: (process.env.APPLE_SIGN_IN_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim(),
  };
  if (!/^[A-Z0-9]{10}$/.test(config.teamId) || !/^[A-Z0-9]{10}$/.test(config.keyId) ||
      !config.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) throw new AppleAuthorizationError("unavailable");
  encryptionKey();
  return config;
}

async function clientSecret(config: AppleSignInConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId).setAudience("https://appleid.apple.com").setSubject(config.clientId)
    .setIssuedAt(now).setExpirationTime(now + 300).sign(key);
}

async function appleRequest(path: "token" | "revoke", fields: Record<string, string>, options: AppleTokenOptions): Promise<Response> {
  const config = options.config ?? getAppleSignInConfig();
  try {
    return await (options.fetchImpl ?? fetch)(`https://appleid.apple.com/auth/${path}`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(5_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, client_id: config.clientId, client_secret: await clientSecret(config) }).toString(),
    });
  } catch {
    throw new AppleAuthorizationError("unavailable");
  }
}

export async function exchangeAppleAuthorizationCode(code: string, subject: string, options: AppleTokenOptions = {}): Promise<string> {
  if (!code || code.length > 4_096 || /\s/.test(code)) throw new AppleAuthorizationError("invalid");
  const response = await appleRequest("token", { grant_type: "authorization_code", code }, options);
  let data: Record<string, unknown>;
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    data = value as Record<string, unknown>;
  } catch { throw new AppleAuthorizationError("unavailable"); }
  if (!response.ok) throw new AppleAuthorizationError(data.error === "invalid_grant" ? "invalid" : "unavailable");
  if (typeof data.id_token !== "string" || typeof data.refresh_token !== "string" || !data.refresh_token || data.refresh_token.length > 8_192) {
    throw new AppleAuthorizationError("unavailable");
  }
  try {
    await verifyAppleCodeIdentity(data.id_token, subject, { clientId: options.config?.clientId ?? appleClientId(), keyResolver: options.keyResolver });
  } catch { throw new AppleAuthorizationError("invalid"); }
  return data.refresh_token;
}

function authorizationKey(accountId: string) {
  if (!UUID.test(accountId)) throw new AppleAuthorizationError("unavailable");
  return `doodle:account:${accountId}:apple-authorization`;
}

function encryptionKey(): Buffer {
  const encoded = required("APPLE_AUTHORIZATION_ENCRYPTION_KEY").trim();
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== encoded) throw new AppleAuthorizationError("unavailable");
  return key;
}

function associatedData(accountId: string): Buffer {
  return Buffer.from(`doodle.apple.authorization.v1:${accountId}:${appleClientId()}`);
}

export async function storeAppleAuthorization(account: { id: string; identityKey: string }, refreshToken: string, authenticatedAt: number): Promise<void> {
  const accountId = account.id;
  const key = authorizationKey(accountId);
  if (!/^[a-f0-9]{64}$/.test(account.identityKey) || !Number.isSafeInteger(authenticatedAt) || authenticatedAt < 0 ||
      !refreshToken || refreshToken.length > 8_192) throw new AppleAuthorizationError("unavailable");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(associatedData(accountId));
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const encrypted = JSON.stringify({ version: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") });
  const result = await redisCommand(["EVAL", STORE_AUTHORIZATION, "6", `doodle:account:${accountId}:active`, `doodle:account:${accountId}:deleted`, key,
    `doodle:auth:apple:${account.identityKey}:state`, `doodle:account:${accountId}:apple-authorized-at`, `doodle:account:${accountId}:apple-revoked-authorization`, encrypted, authenticatedAt]);
  if (result !== 1) throw new AppleAuthorizationError("unavailable");
}

export async function revokeAppleAuthorization(accountId: string, options: AppleTokenOptions = {}): Promise<string> {
  const encrypted = await redisCommand(["GET", authorizationKey(accountId)]);
  let refreshToken: string;
  try {
    if (typeof encrypted !== "string" || encrypted.length > 16_000) throw new Error();
    const value = JSON.parse(encrypted) as { version: unknown; iv: string; tag: string; ciphertext: string };
    if (value.version !== 1 || ![value.iv, value.tag, value.ciphertext].every(v => typeof v === "string" && /^[A-Za-z0-9_-]+$/.test(v))) throw new Error();
    const iv = Buffer.from(value.iv, "base64url"), tag = Buffer.from(value.tag, "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAAD(associatedData(accountId));
    decipher.setAuthTag(tag);
    refreshToken = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64url")), decipher.final()]).toString("utf8");
    if (!refreshToken || refreshToken.length > 8_192) throw new Error();
  } catch { throw new AppleAuthorizationError("unavailable"); }
  const response = await appleRequest("revoke", { token: refreshToken, token_type_hint: "refresh_token" }, options);
  if (!response.ok) throw new AppleAuthorizationError("unavailable");
  // Keep the encrypted value until the account deletion transaction succeeds.
  // Apple returns 200 for a token already revoked, so a Redis failure is retryable.
  return encrypted as string;
}
