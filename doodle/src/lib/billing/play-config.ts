import "server-only";

import { createHmac } from "node:crypto";

export const PLAY_PACKAGE_NAME = "nl.samistudio.doodle";
export const PLAY_PRODUCT_ID = "doodle_credits_10";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlayServiceAccountCredentials = {
  type: "service_account";
  client_email: string;
  private_key: string;
};

export type PlayBillingConfig = {
  packageName: typeof PLAY_PACKAGE_NAME;
  productId: typeof PLAY_PRODUCT_ID;
  credentials: PlayServiceAccountCredentials;
};

function configurationError(): never {
  throw new Error("Play billing is not configured");
}

function accountLinkSecret() {
  const secret = process.env.PLAY_ACCOUNT_LINK_SECRET;
  if (!secret || secret.length < 32) configurationError();
  return secret;
}

export function getPlayBillingConfig(): PlayBillingConfig | null {
  if (process.env.PLAY_BILLING_ENABLED !== "true") return null;
  accountLinkSecret();
  let value: unknown;
  try {
    value = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? "");
  } catch {
    configurationError();
  }
  if (!value || typeof value !== "object") configurationError();
  const credentials = value as Partial<PlayServiceAccountCredentials>;
  if (
    credentials.type !== "service_account" ||
    typeof credentials.client_email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(credentials.client_email) ||
    typeof credentials.private_key !== "string" ||
    !credentials.private_key.startsWith("-----BEGIN PRIVATE KEY-----\n") ||
    !credentials.private_key.trimEnd().endsWith("-----END PRIVATE KEY-----")
  ) configurationError();
  return {
    packageName: PLAY_PACKAGE_NAME,
    productId: PLAY_PRODUCT_ID,
    credentials: credentials as PlayServiceAccountCredentials,
  };
}

export function playAccountId(accountId: string): string {
  if (!UUID_PATTERN.test(accountId)) configurationError();
  return createHmac("sha256", accountLinkSecret()).update(`play-account:${accountId}`).digest("hex");
}
