import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), verify: vi.fn(), client: vi.fn(), verifier: vi.fn() }));
vi.mock("@apple/app-store-server-library", () => ({
  Environment: { SANDBOX: "Sandbox", PRODUCTION: "Production" },
  AppStoreServerAPIClient: class { constructor(...args: unknown[]) { mocks.client(...args); } getTransactionInfo = mocks.lookup; },
  SignedDataVerifier: class { constructor(...args: unknown[]) { mocks.verifier(...args); } verifyAndDecodeTransaction = mocks.verify; },
}));
import { createApplePurchaseLookup } from "./apple-purchase";
const config = { privateKey: "test-only-key", keyId: "ABCDEFGHIJ", issuerId: "11111111-1111-4111-8111-111111111111", bundleId: "nl.samistudio.doodle", appAppleId: 6822104495, environment: "Sandbox" as const, productIds: ["pack_mini", "pack_regular", "pack_big"] };
const transaction = { transactionId: "200000000000001", originalTransactionId: "200000000000001", bundleId: config.bundleId, productId: "pack_regular", type: "Consumable", quantity: 1, appAccountToken: "22222222-2222-4222-8222-222222222222", inAppOwnershipType: "PURCHASED", environment: "Sandbox", purchaseDate: 1_791_800_000_000 };
beforeEach(() => { vi.clearAllMocks(); mocks.lookup.mockResolvedValue({ signedTransactionInfo: "Apple-signed-transaction" }); mocks.verify.mockResolvedValue({ ...transaction }); });
describe("Apple purchase lookup", () => {
  it("retrieves the transaction from Apple and verifies it with pinned roots and online checks", async () => {
    const lookup = createApplePurchaseLookup(config);
    await expect(lookup(transaction.transactionId)).resolves.toMatchObject({ ...transaction, appAccountToken: transaction.appAccountToken });
    expect(mocks.lookup).toHaveBeenCalledExactlyOnceWith(transaction.transactionId);
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith("Apple-signed-transaction");
    expect(mocks.client).toHaveBeenCalledWith(config.privateKey, config.keyId, config.issuerId, config.bundleId, "Sandbox");
    expect(mocks.verifier).toHaveBeenCalledWith([expect.any(Buffer)], true, "Sandbox", config.bundleId, config.appAppleId);
  });
  it.each(["pack_mini", "pack_regular", "pack_big"])("accepts only a verified single consumable %s", async productId => {
    mocks.verify.mockResolvedValue({ ...transaction, productId });
    await expect(createApplePurchaseLookup(config)(transaction.transactionId)).resolves.toMatchObject({ productId, quantity: 1 });
  });
  it.each([
    { transactionId: "999" }, { originalTransactionId: undefined }, { bundleId: "another.app" },
    { environment: "Production" }, { environment: "Xcode" }, { productId: "unregistered" },
    { type: "Non-Consumable" }, { quantity: 2 }, { appAccountToken: undefined },
    { appAccountToken: "private-email@example.com" }, { inAppOwnershipType: "FAMILY_SHARED" },
    { purchaseDate: NaN }, { purchaseDate: -1 }, { advancedCommerceInfo: {} },
  ])("rejects invalid verified fields $productId $type $environment", async patch => {
    mocks.verify.mockResolvedValue({ ...transaction, ...patch });
    await expect(createApplePurchaseLookup(config)(transaction.transactionId)).rejects.toMatchObject({ kind: "invalid" });
  });
  it("preserves signed revocation information so the ledger can create a refund-before-grant tombstone", async () => {
    mocks.verify.mockResolvedValue({ ...transaction, revocationDate: transaction.purchaseDate + 1000, revocationReason: 1 });
    await expect(createApplePurchaseLookup(config)(transaction.transactionId)).resolves.toMatchObject({ revocationDate: transaction.purchaseDate + 1000, revocationReason: 1 });
  });
  it("rejects malformed transaction IDs before calling Apple", async () => {
    const lookup = createApplePurchaseLookup(config);
    for (const id of ["", "../private", "1".repeat(33), "1\n"]) await expect(lookup(id)).rejects.toMatchObject({ kind: "invalid" });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("never accepts lookup or signature failures or leaks their raw messages", async () => {
    mocks.lookup.mockRejectedValueOnce(new Error("private Apple credentials"));
    const lookup = createApplePurchaseLookup(config);
    await expect(lookup(transaction.transactionId)).rejects.toMatchObject({ kind: "unavailable", message: "Apple purchase unavailable" });
    mocks.verify.mockRejectedValueOnce(new Error("private signature payload"));
    await expect(lookup(transaction.transactionId)).rejects.toMatchObject({ kind: "invalid", message: "Apple purchase invalid" });
  });
  it("never sends an unsigned or unbounded response into the verifier", async () => {
    const lookup = createApplePurchaseLookup(config);
    for (const response of [{}, { signedTransactionInfo: "" }, { signedTransactionInfo: "x".repeat(32769) }]) {
      mocks.lookup.mockResolvedValueOnce(response);
      await expect(lookup(transaction.transactionId)).rejects.toMatchObject({ kind: "invalid" });
    }
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("separates production verification and requires the fixed App Store identity", async () => {
    mocks.verify.mockResolvedValue({ ...transaction, environment: "Production" });
    await expect(createApplePurchaseLookup({ ...config, environment: "Production" })(transaction.transactionId)).resolves.toMatchObject({ environment: "Production" });
    expect(mocks.verifier).toHaveBeenCalledWith([expect.any(Buffer)], true, "Production", config.bundleId, config.appAppleId);
    expect(() => createApplePurchaseLookup({ ...config, appAppleId: 0 })).toThrow();
    expect(() => createApplePurchaseLookup({ ...config, environment: "Xcode" as "Sandbox" })).toThrow();
  });
  it("accepts App Review's verified sandbox transaction after a production lookup misses it", async () => {
    mocks.lookup.mockRejectedValueOnce({ httpStatusCode: 404 });
    await expect(createApplePurchaseLookup({ ...config, environment: "Production" })(transaction.transactionId)).resolves.toMatchObject({ environment: "Sandbox" });
  });
});
