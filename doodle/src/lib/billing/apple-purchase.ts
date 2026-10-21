import "server-only";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from "@apple/app-store-server-library";
import appleRoot from "../apple-attestation-root.json";

export interface ApplePurchaseConfiguration {
  privateKey: string;
  keyId: string;
  issuerId: string;
  bundleId: string;
  appAppleId: number;
  environment: "Sandbox" | "Production";
  productIds: readonly string[];
}
export interface VerifiedApplePurchase {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  type: "Consumable";
  quantity: 1;
  appAccountToken: string;
  inAppOwnershipType: "PURCHASED";
  environment: "Sandbox" | "Production";
  purchaseDate: number;
  revocationDate?: number;
  revocationReason?: number;
  revocationPercentage?: number;
}
export class ApplePurchaseError extends Error {
  constructor(readonly kind: "invalid" | "unavailable") {
    super(`Apple purchase ${kind}`);
  }
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TRANSACTION = /^[0-9]{1,32}$/;
function invalid(): never { throw new ApplePurchaseError("invalid"); }
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= Date.now() + 300_000;

// Apple performs the signature, trust-chain, revocation, bundle and environment
// checks. Only verified single consumables reach the credit-delivery boundary.
export function createApplePurchaseLookup(config: ApplePurchaseConfiguration): (transactionId: string) => Promise<VerifiedApplePurchase> {
  if (!config.privateKey || !/^[A-Z0-9]{10}$/.test(config.keyId) || !UUID.test(config.issuerId) || config.bundleId !== "nl.samistudio.doodle" || config.appAppleId !== 6822104495 || (config.environment !== "Sandbox" && config.environment !== "Production") || !config.productIds.length || config.productIds.some(id => !/^[A-Za-z0-9._-]{1,100}$/.test(id))) throw new ApplePurchaseError("unavailable");
  const environment = config.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  const client = new AppStoreServerAPIClient(config.privateKey, config.keyId, config.issuerId, config.bundleId, environment);
  const verifier = new SignedDataVerifier([Buffer.from(appleRoot.certificate, "base64")], true, environment, config.bundleId, config.appAppleId);
  return async transactionId => {
    if (typeof transactionId !== "string" || !TRANSACTION.test(transactionId)) invalid();
    let signed: unknown;
    try { signed = (await client.getTransactionInfo(transactionId)).signedTransactionInfo; }
    catch (error) {
      const status = error && typeof error === "object" && "httpStatusCode" in error ? error.httpStatusCode : undefined;
      if (config.environment === "Production" && status === 404) return createApplePurchaseLookup({ ...config, environment: "Sandbox" })(transactionId);
      throw new ApplePurchaseError(status === 400 || status === 404 ? "invalid" : "unavailable");
    }
    if (typeof signed !== "string" || !signed || signed.length > 32_768) invalid();
    let transaction;
    try { transaction = await verifier.verifyAndDecodeTransaction(signed); }
    catch (error) {
      // The official verifier uses status 2 for temporary OCSP/network failures.
      const retryable = error && typeof error === "object" && "status" in error && error.status === 2;
      throw new ApplePurchaseError(retryable ? "unavailable" : "invalid");
    }
    if (transaction.transactionId !== transactionId || typeof transaction.originalTransactionId !== "string" || !TRANSACTION.test(transaction.originalTransactionId) || transaction.bundleId !== config.bundleId || transaction.environment !== config.environment || typeof transaction.productId !== "string" || !config.productIds.includes(transaction.productId) || transaction.type !== "Consumable" || transaction.quantity !== 1 || typeof transaction.appAccountToken !== "string" || !UUID.test(transaction.appAccountToken) || transaction.inAppOwnershipType !== "PURCHASED" || !timestamp(transaction.purchaseDate) || transaction.advancedCommerceInfo !== undefined || (transaction.revocationDate !== undefined && !timestamp(transaction.revocationDate)) || (transaction.revocationReason !== undefined && ![0, 1].includes(transaction.revocationReason)) || (transaction.revocationReason !== undefined && transaction.revocationDate === undefined) || (transaction.revocationPercentage !== undefined && (transaction.revocationDate === undefined || !Number.isSafeInteger(transaction.revocationPercentage) || transaction.revocationPercentage < 0 || transaction.revocationPercentage > 100_000))) invalid();
    return {
      transactionId, originalTransactionId: transaction.originalTransactionId,
      bundleId: config.bundleId, productId: transaction.productId, type: "Consumable", quantity: 1,
      appAccountToken: transaction.appAccountToken.toLowerCase(), inAppOwnershipType: "PURCHASED",
      environment: config.environment, purchaseDate: transaction.purchaseDate,
      ...(transaction.revocationDate !== undefined ? { revocationDate: transaction.revocationDate } : {}),
      ...(transaction.revocationReason !== undefined ? { revocationReason: transaction.revocationReason } : {}),
      ...(transaction.revocationPercentage !== undefined ? { revocationPercentage: transaction.revocationPercentage } : {}),
    };
  };
}
