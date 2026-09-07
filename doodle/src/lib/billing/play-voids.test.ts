import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlayVoidsClient,
  reconcilePlayVoids,
  validatePlayVoidRange,
  type PlayVoidsClient,
} from "./play-voids";
import type { PlayBillingConfig } from "./play-config";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  getClient: vi.fn(),
  GoogleAuth: vi.fn(),
  previewPlayPurchaseVoid: vi.fn(),
  voidPlayPurchase: vi.fn(),
}));
vi.mock("google-auth-library", () => ({ GoogleAuth: mocks.GoogleAuth }));
vi.mock("./play-credits", () => ({
  previewPlayPurchaseVoid: mocks.previewPlayPurchaseVoid,
  voidPlayPurchase: mocks.voidPlayPurchase,
}));

const config: PlayBillingConfig = {
  packageName: "nl.samistudio.doodle",
  productId: "doodle_credits_10",
  credentials: { type: "service_account", client_email: "billing@example.iam.gserviceaccount.com", private_key: "key" },
};
const now = Date.UTC(2026, 8, 7, 12);

describe("Play voided-purchase reconciliation", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getClient.mockResolvedValue({ request: mocks.request });
    mocks.GoogleAuth.mockImplementation(() => ({ getClient: mocks.getClient }));
    mocks.previewPlayPurchaseVoid.mockResolvedValue({ status: "reversed", recovered: 8, unrecovered: 2, priorState: "consumed" });
    mocks.voidPlayPurchase.mockResolvedValue({ status: "reversed", recovered: 8, unrecovered: 2, priorState: "consumed" });
  });

  it("accepts only an ordered range within Google's 30-day window", () => {
    expect(validatePlayVoidRange(now - 30 * 86_400_000, now, now)).toEqual({ startTimeMs: now - 30 * 86_400_000, endTimeMs: now });
    expect(() => validatePlayVoidRange(now - 30 * 86_400_000 - 1, now, now)).toThrow("within 30 days");
    expect(() => validatePlayVoidRange(now, now + 1, now)).toThrow("future");
    expect(() => validatePlayVoidRange(now, now - 1, now)).toThrow("ordered");
  });

  it("calls the official in-app voids endpoint with bounded pages and no body", async () => {
    mocks.request.mockResolvedValue({ data: { voidedPurchases: [] } });
    const client = createPlayVoidsClient(config);
    await client.listVoidedPurchases({ startTimeMs: now - 86_400_000, endTimeMs: now });
    const request = mocks.request.mock.calls[0][0] as { method: string; timeout: number; url: string; data?: unknown };
    const url = new URL(request.url);
    expect(request).toMatchObject({ method: "GET", timeout: 15_000 });
    expect(request).not.toHaveProperty("data");
    expect(url.pathname).toBe("/androidpublisher/v3/applications/nl.samistudio.doodle/purchases/voidedpurchases");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      startTime: String(now - 86_400_000), endTime: String(now), type: "0",
      includeQuantityBasedPartialRefund: "true", maxResults: "100",
    });
  });

  it("uses only the page token after the first page", async () => {
    mocks.request.mockResolvedValue({ data: { voidedPurchases: [] } });
    const client = createPlayVoidsClient(config);
    await client.listVoidedPurchases({ startTimeMs: now - 86_400_000, endTimeMs: now, pageToken: "next-page" });
    const url = new URL(mocks.request.mock.calls[0][0].url);
    expect(url.searchParams.get("token")).toBe("next-page");
    expect(url.searchParams.has("startTime")).toBe(false);
    expect(url.searchParams.has("endTime")).toBe(false);
  });

  it("defaults to read-only preview, paginates, and returns aggregate impact without tokens", async () => {
    const listVoidedPurchases = vi.fn()
      .mockResolvedValueOnce({ voidedPurchases: [{ purchaseToken: "token-one-123456", voidedTimeMillis: String(now - 1000), voidedReason: 7, voidedSource: 2, voidedQuantity: 1 }], nextPageToken: "page-2" })
      .mockResolvedValueOnce({ voidedPurchases: [
        { purchaseToken: "token-one-123456", voidedTimeMillis: String(now - 1000), voidedReason: 7, voidedSource: 2, voidedQuantity: 1 },
        { purchaseToken: "token-two-123456", voidedTimeMillis: String(now - 500), voidedReason: 1, voidedSource: 0 },
      ], nextPageToken: undefined });
    const summary = await reconcilePlayVoids({ client: { listVoidedPurchases }, startTimeMs: now - 86_400_000, endTimeMs: now, nowMs: now });

    expect(listVoidedPurchases).toHaveBeenCalledTimes(2);
    expect(mocks.previewPlayPurchaseVoid).toHaveBeenCalledTimes(2);
    expect(mocks.voidPlayPurchase).not.toHaveBeenCalled();
    expect(mocks.previewPlayPurchaseVoid).toHaveBeenNthCalledWith(1, "token-one-123456", {
      voidedAt: new Date(now - 1000).toISOString(), voidedReason: 7, voidedSource: 2, voidedQuantity: 1,
    });
    expect(summary).toEqual({ mode: "dry-run", fetched: 3, alreadyVoided: 0, tombstoned: 0, reversed: 2, deletedAccounts: 0, inactiveAccounts: 0, recovered: 16, unrecovered: 4 });
    expect(JSON.stringify(summary)).not.toContain("token-");
  });

  it("applies through the atomic void function only when explicitly requested", async () => {
    const client: PlayVoidsClient = { listVoidedPurchases: vi.fn().mockResolvedValue({
      voidedPurchases: [{ purchaseToken: "token-one-123456", voidedTimeMillis: String(now), voidedReason: 5, voidedSource: 2, voidedQuantity: 1 }],
    }) };
    const summary = await reconcilePlayVoids({ client, startTimeMs: now - 1000, endTimeMs: now, nowMs: now, apply: true });
    expect(mocks.voidPlayPurchase).toHaveBeenCalledTimes(1);
    expect(mocks.previewPlayPurchaseVoid).not.toHaveBeenCalled();
    expect(summary.mode).toBe("apply");
  });

  it("does not report a prior reversal as impact from an idempotent replay", async () => {
    mocks.voidPlayPurchase.mockResolvedValue({ status: "already_voided", recovered: 8, unrecovered: 2, priorState: "consumed" });
    const client: PlayVoidsClient = { listVoidedPurchases: vi.fn().mockResolvedValue({
      voidedPurchases: [{ purchaseToken: "token-one-123456", voidedTimeMillis: String(now), voidedReason: 5, voidedSource: 2, voidedQuantity: 1 }],
    }) };
    const summary = await reconcilePlayVoids({ client, startTimeMs: now - 1000, endTimeMs: now, nowMs: now, apply: true });
    expect(summary).toMatchObject({ alreadyVoided: 1, recovered: 0, unrecovered: 0 });
  });

  it("rejects malformed quantities and pagination loops without touching the ledger again", async () => {
    const malformed: PlayVoidsClient = { listVoidedPurchases: vi.fn().mockResolvedValue({
      voidedPurchases: [{ purchaseToken: "token-one-123456", voidedTimeMillis: String(now), voidedReason: 1, voidedSource: 0, voidedQuantity: 2 }],
    }) };
    await expect(reconcilePlayVoids({ client: malformed, startTimeMs: now - 1000, endTimeMs: now, nowMs: now })).rejects.toThrow("Invalid voided purchase");
    expect(mocks.previewPlayPurchaseVoid).not.toHaveBeenCalled();

    const looping: PlayVoidsClient = { listVoidedPurchases: vi.fn().mockResolvedValue({ voidedPurchases: [], nextPageToken: "same" }) };
    await expect(reconcilePlayVoids({ client: looping, startTimeMs: now - 1000, endTimeMs: now, nowMs: now })).rejects.toThrow("pagination loop");
  });
});
