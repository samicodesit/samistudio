import "server-only";
import { Environment, SignedDataVerifier } from "@apple/app-store-server-library";
import appleRoot from "../apple-attestation-root.json";
import { redisCommand } from "@/lib/redis";
import { createApplePurchaseLookup, ApplePurchaseError, type ApplePurchaseConfiguration } from "./apple-purchase";
import { restoreAppleCredits, revokeAppleCredits } from "./apple-credits";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function processAppleBillingNotification(config: ApplePurchaseConfiguration, payload: string): Promise<{ received: true }> {
  if (typeof payload !== "string" || !payload || payload.length > 65_536) throw new ApplePurchaseError("invalid");
  const environment = config.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  const verifier = new SignedDataVerifier([Buffer.from(appleRoot.certificate, "base64")], true, environment, config.bundleId, config.appAppleId);
  let notification;
  try { notification = await verifier.verifyAndDecodeNotification(payload); }
  catch (error) {
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    if (config.environment === "Production" && status === 4) return processAppleBillingNotification({ ...config, environment: "Sandbox" }, payload);
    throw new ApplePurchaseError(status === 2 ? "unavailable" : "invalid");
  }
  const data = notification.data;
  if (notification.version !== "2.0" || !notification.notificationUUID || !UUID.test(notification.notificationUUID) ||
      !Number.isSafeInteger(notification.signedDate) || notification.signedDate! <= 0 || notification.signedDate! > Date.now() + 300_000 ||
      !data || data.bundleId !== config.bundleId || data.environment !== config.environment ||
      (config.environment === "Production" && data.appAppleId !== config.appAppleId) ||
      (data.appAppleId !== undefined && data.appAppleId !== config.appAppleId)) throw new ApplePurchaseError("invalid");
  const base = `doodle:apple:${config.environment.toLowerCase()}`;
  const id = notification.notificationUUID.toLowerCase();
  const completedKey = `${base}:notification:${id}`;
  if (await redisCommand(["GET", completedKey]) === "done") return { received: true };
  const type = notification.notificationType;
  if (type === "REFUND" || type === "REVOKE" || type === "REFUND_REVERSED") {
    if (typeof data.signedTransactionInfo !== "string" || !data.signedTransactionInfo || data.signedTransactionInfo.length > 32_768) throw new ApplePurchaseError("invalid");
    let signed;
    try { signed = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo); }
    catch (error) { throw new ApplePurchaseError(error && typeof error === "object" && "status" in error && error.status === 2 ? "unavailable" : "invalid"); }
    if (!signed.transactionId || !/^\d{1,32}$/.test(signed.transactionId)) throw new ApplePurchaseError("invalid");
    // Lookup current signed state. A delayed refund must not undo a newer reversal.
    const transaction = await createApplePurchaseLookup(config)(signed.transactionId);
    if (type === "REFUND_REVERSED") {
      if (transaction.revocationDate === undefined) await restoreAppleCredits(transaction, notification.signedDate!);
    } else if (transaction.revocationDate !== undefined) await revokeAppleCredits(transaction);
  } else if (type === "CONSUMPTION_REQUEST") {
    // No consent exists at launch. Keep a support marker, without sending personal data.
    await redisCommand(["ZADD", `${base}:consent-required`, notification.signedDate!, id]);
  } else if (type !== "TEST" && type !== "ONE_TIME_CHARGE" && type !== "REFUND_DECLINED") {
    // Preserve unexpected signed event types for review rather than silently dropping them.
    await redisCommand(["HSET", `${base}:notification-review`, id, String(type ?? "unknown").slice(0, 80)]);
  }
  await redisCommand(["SET", completedKey, "done", "EX", 31_622_400]);
  return { received: true };
}
