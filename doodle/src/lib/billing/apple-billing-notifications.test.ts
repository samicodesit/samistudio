import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ notification: vi.fn(), transaction: vi.fn(), lookup: vi.fn(), redis: vi.fn(), refund: vi.fn(), restore: vi.fn() }));
vi.mock("@apple/app-store-server-library", () => ({ Environment: { SANDBOX: "Sandbox", PRODUCTION: "Production" }, SignedDataVerifier: class { verifyAndDecodeNotification = mocks.notification; verifyAndDecodeTransaction = mocks.transaction; } }));
vi.mock("./apple-purchase", async original => ({ ...await original<typeof import("./apple-purchase")>(), createApplePurchaseLookup: () => mocks.lookup }));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.redis }));
vi.mock("./apple-credits", () => ({ revokeAppleCredits: mocks.refund, restoreAppleCredits: mocks.restore }));
import { processAppleBillingNotification } from "./apple-billing-notifications";
const config = { privateKey: "test", keyId: "ABCDEFGHIJ", issuerId: "11111111-1111-4111-8111-111111111111", bundleId: "nl.samistudio.doodle", appAppleId: 6822104495, environment: "Sandbox" as const, productIds: ["pack_mini", "pack_regular", "pack_big"] };
const id = "22222222-2222-4222-8222-222222222222";
const transaction = { transactionId: "200000000000001", productId: "pack_mini", environment: "Sandbox", revocationDate: Date.now() - 1000, revocationReason: 1 };
const notification = { version: "2.0", notificationUUID: id, notificationType: "REFUND", signedDate: Date.now(), data: { environment: "Sandbox", bundleId: "nl.samistudio.doodle", signedTransactionInfo: "signed-transaction" } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.notification.mockResolvedValue({ ...notification }); mocks.transaction.mockResolvedValue({ transactionId: transaction.transactionId });
  mocks.lookup.mockResolvedValue({ ...transaction }); mocks.redis.mockResolvedValue(null); mocks.refund.mockResolvedValue({ status: "reversed" });
});
it("verifies both signatures and refunds before recording completion", async () => {
  await expect(processAppleBillingNotification(config, "signed-notification")).resolves.toEqual({ received: true });
  expect(mocks.refund).toHaveBeenCalledExactlyOnceWith(transaction);
  const completion = mocks.redis.mock.calls.findIndex(([command]) => command[0] === "SET");
  expect(completion).toBeGreaterThanOrEqual(0);
  expect(mocks.redis.mock.invocationCallOrder[completion]).toBeGreaterThan(mocks.refund.mock.invocationCallOrder[0]);
});
it.each([
  { version: "1.0" }, { notificationUUID: "invalid" }, { signedDate: Date.now() + 600000 },
  { data: { ...notification.data, bundleId: "other.app" } }, { data: { ...notification.data, environment: "Production" } },
])("rejects invalid signed notification fields %#", async patch => {
  mocks.notification.mockResolvedValue({ ...notification, ...patch });
  await expect(processAppleBillingNotification(config, "signed-notification")).rejects.toMatchObject({ kind: "invalid" });
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("does not acknowledge refunds when signature or delivery fails", async () => {
  mocks.notification.mockRejectedValueOnce(Error("forged"));
  await expect(processAppleBillingNotification(config, "signed-notification")).rejects.toBeDefined();
  expect(mocks.redis).not.toHaveBeenCalled();
  mocks.refund.mockRejectedValueOnce(Error("Redis unavailable"));
  await expect(processAppleBillingNotification(config, "signed-notification")).rejects.toBeDefined();
  expect(mocks.redis.mock.calls.some(([command]) => command[0] === "SET")).toBe(false);
});
it("ignores a duplicate acknowledged event", async () => {
  mocks.redis.mockResolvedValueOnce("done");
  await expect(processAppleBillingNotification(config, "signed-notification")).resolves.toEqual({ received: true });
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("records a consumption request without sending personal data to Apple", async () => {
  mocks.notification.mockResolvedValue({ ...notification, notificationType: "CONSUMPTION_REQUEST" });
  await expect(processAppleBillingNotification(config, "signed-notification")).resolves.toEqual({ received: true });
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.lookup).not.toHaveBeenCalled();
  expect(mocks.redis.mock.calls.some(([command]) => command[0] === "ZADD" && String(command[1]).endsWith(":consent-required"))).toBe(true);
});
it("accepts a signed notification test with no transaction", async () => {
  mocks.notification.mockResolvedValue({ ...notification, notificationType: "TEST", data: { environment: "Sandbox", bundleId: "nl.samistudio.doodle" } });
  await expect(processAppleBillingNotification(config, "signed-notification")).resolves.toEqual({ received: true });
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("verifies sandbox notifications sent to the production endpoint", async () => {
  mocks.notification.mockRejectedValueOnce({ status: 4 });
  await expect(processAppleBillingNotification({ ...config, environment: "Production" }, "signed-notification")).resolves.toEqual({ received: true });
  expect(mocks.refund).toHaveBeenCalledExactlyOnceWith(transaction);
});
it("restores credits for a verified refund reversal using Apple's current transaction state", async () => {
  mocks.notification.mockResolvedValue({ ...notification, notificationType: "REFUND_REVERSED" });
  mocks.lookup.mockResolvedValue({ ...transaction, revocationDate: undefined });
  await expect(processAppleBillingNotification(config, "signed-notification")).resolves.toEqual({ received: true });
  expect(mocks.restore).toHaveBeenCalledWith(expect.objectContaining({ transactionId: transaction.transactionId }), notification.signedDate);
});
it("returns a retryable error for a temporary failure checking the transaction signature", async () => {
  mocks.transaction.mockRejectedValueOnce({ status: 2 });
  await expect(processAppleBillingNotification(config, "signed-notification")).rejects.toMatchObject({ kind: "unavailable" });
});
