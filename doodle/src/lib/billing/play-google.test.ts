import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlayPublisherClient } from "./play-google";
import type { PlayBillingConfig } from "./play-config";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ request: vi.fn(), getClient: vi.fn(), GoogleAuth: vi.fn() }));
vi.mock("google-auth-library", () => ({ GoogleAuth: mocks.GoogleAuth }));

const config: PlayBillingConfig = {
  packageName: "nl.samistudio.doodle",
  productId: "doodle_credits_10",
  credentials: { type: "service_account", client_email: "billing@example.test", private_key: "key" },
};

describe("Google Play Publisher client", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getClient.mockResolvedValue({ request: mocks.request });
    mocks.GoogleAuth.mockImplementation(() => ({ getClient: mocks.getClient }));
  });

  it("uses ProductPurchaseV2 with the Android Publisher scope and a bounded timeout", async () => {
    mocks.request.mockResolvedValue({ data: { purchaseStateContext: { purchaseState: "PURCHASED" } } });
    const publisher = createPlayPublisherClient(config);
    await publisher.getProductPurchase("token/with/slash");

    expect(mocks.GoogleAuth).toHaveBeenCalledWith(expect.objectContaining({
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    }));
    expect(mocks.request).toHaveBeenCalledWith({
      method: "GET",
      timeout: 15_000,
      url: "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/nl.samistudio.doodle/purchases/productsv2/tokens/token%2Fwith%2Fslash",
    });
  });

  it("consumes server-side with an empty request body", async () => {
    mocks.request.mockResolvedValue({ data: {} });
    const publisher = createPlayPublisherClient(config);
    await publisher.consumeProductPurchase("doodle_credits_10", "token/with/slash");

    expect(mocks.request).toHaveBeenCalledWith({
      method: "POST",
      timeout: 15_000,
      url: "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/nl.samistudio.doodle/purchases/products/doodle_credits_10/tokens/token%2Fwith%2Fslash:consume",
    });
  });
});
