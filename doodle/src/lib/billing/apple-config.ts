import "server-only";
import { PLAY_PACK_IDS } from "./play-catalog";
import type { ApplePurchaseConfiguration } from "./apple-purchase";

export function getAppleBillingConfig(): ApplePurchaseConfiguration | null {
  if (process.env.APPLE_BILLING_ENABLED !== "true") return null;
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const issuerId = process.env.APPLE_IAP_ISSUER_ID;
  const environment = process.env.APPLE_IAP_ENVIRONMENT;
  if (!privateKey?.startsWith("-----BEGIN PRIVATE KEY-----\n") || !privateKey.trimEnd().endsWith("-----END PRIVATE KEY-----") ||
      !keyId || !/^[A-Z0-9]{10}$/.test(keyId) || !issuerId ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(issuerId) ||
      (environment !== "Sandbox" && environment !== "Production") || process.env.APPLE_IAP_PRODUCTS_CONFIRMED !== "true") {
    throw new Error("Apple billing not configured");
  }
  return { privateKey, keyId, issuerId, environment, bundleId: "nl.samistudio.doodle", appAppleId: 6822104495, productIds: PLAY_PACK_IDS };
}
