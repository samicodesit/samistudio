import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayPurchaseError } from "@/lib/billing/play-purchase";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPlayBillingConfig: vi.fn(),
  playAccountId: vi.fn(),
  createPlayPublisherClient: vi.fn(),
  processPlayPurchase: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/billing/play-config", () => ({
  PLAY_PRODUCT_ID: "doodle_credits_10",
  getPlayBillingConfig: mocks.getPlayBillingConfig,
  playAccountId: mocks.playAccountId,
}));
vi.mock("@/lib/billing/play-google", () => ({ createPlayPublisherClient: mocks.createPlayPublisherClient }));
vi.mock("@/lib/billing/play-purchase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/play-purchase")>()),
  processPlayPurchase: mocks.processPlayPurchase,
}));

const config = {
  packageName: "nl.samistudio.doodle",
  productId: "doodle_credits_10",
  credentials: { type: "service_account", client_email: "billing@example.iam.gserviceaccount.com", private_key: "private" },
};
const publisher = { getProductPurchase: vi.fn(), consumeProductPurchase: vi.fn() };

function request(body: unknown, options: { origin?: string; contentLength?: string } = {}) {
  const encoded = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = {
    origin: options.origin ?? "https://doodle.samistudio.nl",
    "content-type": "application/json",
  };
  if (options.contentLength) headers["content-length"] = options.contentLength;
  return new Request("https://doodle.samistudio.nl/api/play/verify", { method: "POST", headers, body: encoded });
}

describe("Play purchase verification route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCurrentUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.getPlayBillingConfig.mockReturnValue(config);
    mocks.playAccountId.mockReturnValue("a".repeat(64));
    mocks.createPlayPublisherClient.mockReturnValue(publisher);
    mocks.processPlayPurchase.mockResolvedValue({ status: "granted", balance: 10 });
  });

  it("rejects cross-origin requests before authentication", async () => {
    const response = await POST(request({ purchaseToken: "valid-purchase-token", productId: "doodle_credits_10" }, { origin: "https://attacker.test" }));
    expect(response.status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("requires an authenticated Doodle account", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(request({ purchaseToken: "valid-purchase-token", productId: "doodle_credits_10" }));
    expect(response.status).toBe(401);
    expect(mocks.processPlayPurchase).not.toHaveBeenCalled();
  });

  it("fails closed while Play billing is disabled", async () => {
    mocks.getPlayBillingConfig.mockReturnValue(null);
    const response = await POST(request({ purchaseToken: "valid-purchase-token", productId: "doodle_credits_10" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "play_unavailable" });
  });

  it("rejects declared and streamed bodies over 4096 bytes", async () => {
    const declared = await POST(request({}, { contentLength: "4097" }));
    expect(declared.status).toBe(413);

    const streamed = await POST(request(`{"purchaseToken":"${"x".repeat(4096)}","productId":"doodle_credits_10"}`));
    expect(streamed.status).toBe(413);
    expect(mocks.processPlayPurchase).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{"],
    ["extra keys", { purchaseToken: "valid-purchase-token", productId: "doodle_credits_10", accountId: "attacker" }],
    ["wrong SKU", { purchaseToken: "valid-purchase-token", productId: "other" }],
    ["short token", { purchaseToken: "short", productId: "doodle_credits_10" }],
    ["token whitespace", { purchaseToken: "valid purchase token", productId: "doodle_credits_10" }],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(mocks.processPlayPurchase).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", 409, "purchase_pending"],
    ["invalid", 400, "invalid_purchase"],
    ["foreign", 403, "purchase_account_mismatch"],
    ["unavailable", 503, "play_unavailable"],
  ] as const)("maps %s purchase errors", async (kind, status, code) => {
    mocks.processPlayPurchase.mockRejectedValue(new PlayPurchaseError(kind));
    const response = await POST(request({ purchaseToken: "valid-purchase-token", productId: "doodle_credits_10" }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a verified balance using only server-derived account binding", async () => {
    const incoming = request({ purchaseToken: "valid-purchase-token", productId: "doodle_credits_10" });
    const response = await POST(incoming);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "granted", balance: 10 });
    expect(mocks.processPlayPurchase).toHaveBeenCalledWith({
      accountId: "11111111-1111-4111-8111-111111111111",
      expectedObfuscatedAccountId: "a".repeat(64),
      purchaseToken: "valid-purchase-token",
      productId: "doodle_credits_10",
      publisher,
    });
    expect(mocks.getCurrentUser).toHaveBeenCalledWith(incoming);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("hides unexpected internal errors", async () => {
    mocks.processPlayPurchase.mockRejectedValue(new Error("service secret"));
    const response = await POST(request({ purchaseToken: "valid-purchase-token", productId: "doodle_credits_10" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "play_unavailable" });
  });
});
