import "server-only";
import { createHash, createPublicKey, webcrypto, X509Certificate } from "node:crypto";
import cbor from "cbor";
import { verifyAssertion, verifyAttestation } from "node-app-attest";
import * as asn1 from "asn1js";
import { Certificate, ContentInfo, CryptoEngine, SignedData } from "pkijs";
import receiptRoot from "./apple-attestation-root.json";

export type AppleAttestEnvironment = "development" | "production";
export interface AppleAttestVerificationConfig {
  teamIdentifier: string;
  bundleIdentifier: string;
  environment: AppleAttestEnvironment;
  allowedBuilds: readonly string[];
  now?: number;
}

function invalid(): never { throw new Error("Invalid Apple attestation"); }
function binary(value: string, maxBytes = 24_576): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0 || value.length > maxBytes * 4 / 3 + 4) invalid();
  const decoded = Buffer.from(value, "base64");
  if (!decoded.length || decoded.length > maxBytes || decoded.toString("base64") !== value) invalid();
  return decoded;
}
function decode(value: Buffer): Record<string, unknown> {
  const objects = cbor.decodeAllSync(value, { max_depth: 16 });
  if (objects.length !== 1 || !objects[0] || typeof objects[0] !== "object" || Array.isArray(objects[0]) || objects[0] instanceof Map) invalid();
  return objects[0] as Record<string, unknown>;
}
function extensions(authData: Buffer, start: number, config: AppleAttestVerificationConfig): void {
  const hasExtensions = (authData[32] & 128) !== 0;
  if (!hasExtensions) {
    if (authData.length !== start) invalid();
    return; // Older Apple-signed iOS objects have no extension dictionary.
  }
  const value = decode(authData.subarray(start));
  const encodedCategory = value.apple_validation_category_01 ?? value.validationCategory;
  // Apple's current validation-guide sample encodes UInt32 as four LE bytes.
  const category = Buffer.isBuffer(encodedCategory) && encodedCategory.length === 4 ? encodedCategory.readUInt32LE() : encodedCategory;
  const build = value.apple_bundle_version_01 ?? value.bundleVersion;
  const accepted = config.environment === "development" ? [3] : [2, 4];
  if (typeof category !== "number" || !accepted.includes(category) || typeof build !== "string" || !config.allowedBuilds.includes(build)) invalid();
}

export function verifyAppleKey(input: { attestation: string; keyId: string; payload: string | Buffer }, config: AppleAttestVerificationConfig): { keyId: string; publicKey: string; receipt: string; environment: AppleAttestEnvironment } {
  if (binary(input.keyId, 32).length !== 32) invalid();
  const attestation = binary(input.attestation);
  const object = decode(attestation);
  const statement = object.attStmt as { x5c?: unknown[] } | undefined;
  if (!statement || !Array.isArray(statement.x5c) || statement.x5c.length !== 2 || !statement.x5c.every(Buffer.isBuffer) || !Buffer.isBuffer(object.authData)) invalid();
  const certificates = statement.x5c.map(value => new X509Certificate(value as Buffer));
  const now = config.now ?? Date.now();
  if (certificates[0].ca || !certificates[1].ca || !certificates[0].checkIssued(certificates[1]) || certificates.some(cert => now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo))) invalid();
  const result = verifyAttestation({ attestation, challenge: input.payload, keyId: input.keyId, bundleIdentifier: config.bundleIdentifier, teamIdentifier: config.teamIdentifier, allowDevelopmentEnvironment: config.environment === "development" });
  if (result.environment !== config.environment || typeof result.publicKey !== "string" || !Buffer.isBuffer(result.receipt)) invalid();
  const auth = object.authData;
  if (auth.length < 87 || (auth[32] & 64) === 0 || auth.readUInt16BE(53) !== 32) invalid();
  const keyData = cbor.decodeFirstSync(auth.subarray(87), { extendedResults: true, max_depth: 16 }) as { length: number };
  if (!Number.isSafeInteger(keyData.length) || keyData.length <= 0) invalid();
  extensions(auth, 87 + keyData.length, config);
  return { keyId: input.keyId, publicKey: result.publicKey, receipt: result.receipt.toString("base64"), environment: config.environment };
}

export function verifyAppleRequest(input: { assertion: string; payload: string; publicKey: string; signCount: number }, config: AppleAttestVerificationConfig): { signCount: number } {
  if (!Number.isSafeInteger(input.signCount) || input.signCount < 0 || input.signCount > 0xffffffff) invalid();
  const assertion = binary(input.assertion, 4096);
  const object = decode(assertion);
  if (!Buffer.isBuffer(object.signature) || !Buffer.isBuffer(object.authenticatorData) || object.authenticatorData.length < 37) invalid();
  extensions(object.authenticatorData, 37, config);
  const result = verifyAssertion({ assertion, payload: input.payload, publicKey: input.publicKey, bundleIdentifier: config.bundleIdentifier, teamIdentifier: config.teamIdentifier, signCount: input.signCount });
  if (!Number.isSafeInteger(result.signCount) || result.signCount <= input.signCount || result.signCount > 0x7fffffff) invalid();
  return { signCount: result.signCount };
}

function schema(bytes: Uint8Array) {
  const decoded = asn1.fromBER(new Uint8Array(bytes).buffer);
  if (decoded.offset !== bytes.byteLength || decoded.result.error) invalid();
  return decoded.result;
}
const receiptEngine = new CryptoEngine({ name: "Doodle Apple receipts", crypto: webcrypto as unknown as Crypto });
const receiptRootCertificate = new Certificate({ schema: schema(binary(receiptRoot.certificate)) });

export async function verifyAppleReceipt(input: { receipt: string; publicKey: string; payload: string | Buffer }, config: AppleAttestVerificationConfig): Promise<void> {
  const content = new ContentInfo({ schema: schema(binary(input.receipt)) });
  if (content.contentType !== "1.2.840.113549.1.7.2") invalid();
  const signed = new SignedData({ schema: content.content });
  const now = config.now ?? Date.now();
  if (signed.signerInfos.length !== 1 || !signed.encapContentInfo.eContent || !await signed.verify({ signer: 0, checkChain: true, trustedCerts: [receiptRootCertificate], checkDate: new Date(now), passedWhenNotRevValues: true }, receiptEngine)) invalid();
  const payload = schema(new Uint8Array(signed.encapContentInfo.eContent.getValue()));
  if (!(payload instanceof asn1.Set) || payload.valueBlock.value.length > 32) invalid();
  const fields = new Map<number, Buffer>();
  for (const field of payload.valueBlock.value) {
    if (!(field instanceof asn1.Sequence) || field.valueBlock.value.length !== 3) invalid();
    const [type, version, value] = field.valueBlock.value;
    if (!(type instanceof asn1.Integer) || !(version instanceof asn1.Integer) || !(value instanceof asn1.OctetString) || fields.has(type.valueBlock.valueDec)) invalid();
    fields.set(type.valueBlock.valueDec, Buffer.from(value.getValue()));
  }
  if (fields.get(2)?.toString() !== `${config.teamIdentifier}.${config.bundleIdentifier}` || fields.get(6)?.toString() !== "ATTEST" || fields.get(7)?.toString() !== (config.environment === "development" ? "sandbox" : "production")) invalid();
  const created = Date.parse(fields.get(12)?.toString() ?? "");
  if (!Number.isFinite(created) || created > now + 5000 || now - created > 300_000) invalid();
  const keyData = fields.get(3), clientHash = fields.get(4);
  if (!keyData || !clientHash?.equals(createHash("sha256").update(input.payload).digest())) invalid();
  const receiptKey = new X509Certificate(keyData).publicKey.export({ type: "spki", format: "der" });
  if (!receiptKey.equals(createPublicKey(input.publicKey).export({ type: "spki", format: "der" }))) invalid();
}
