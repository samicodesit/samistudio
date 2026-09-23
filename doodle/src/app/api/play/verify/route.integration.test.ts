import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPlayBillingConfig: vi.fn(),
  playAccountId: vi.fn(),
  createPlayPublisherClient: vi.fn(),
  redisCommand: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/billing/play-config", () => ({
  PLAY_PRODUCT_ID: "doodle_credits_10",
  getPlayBillingConfig: mocks.getPlayBillingConfig,
  playAccountId: mocks.playAccountId,
}));
vi.mock("@/lib/billing/play-google", () => ({ createPlayPublisherClient: mocks.createPlayPublisherClient }));
vi.mock("@/lib/redis", () => ({
  redisCommand: mocks.redisCommand,
  redisInteger: (value: unknown) => Number(value),
}));

const accountId = "11111111-1111-4111-8111-111111111111";
const token = "token-1234567890";
const publisher = {
  getProductPurchase: vi.fn(),
  consumeProductPurchase: vi.fn(),
};
const purchase = {
  purchaseStateContext: { purchaseState: "PURCHASED" },
  obfuscatedExternalAccountId: "bound-account",
  productLineItem: [{
    productId: "doodle_credits_10",
    productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" },
  }],
};

function request() {
  return new Request("https://doodle.samistudio.nl/api/play/verify", {
    method: "POST",
    headers: { origin: "https://doodle.samistudio.nl", "content-type": "application/json" },
    body: JSON.stringify({ purchaseToken: token, productId: "doodle_credits_10" }),
  });
}

describe("Play verification route with the real credit path", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    publisher.getProductPurchase.mockResolvedValue(purchase);
    publisher.consumeProductPurchase.mockResolvedValue(undefined);
    mocks.getCurrentUser.mockResolvedValue({ id: accountId });
    mocks.getPlayBillingConfig.mockReturnValue({ packageName: "nl.samistudio.doodle", productId: "doodle_credits_10", credentials: { type: "service_account", client_email: "billing@example.iam.gserviceaccount.com", private_key: "private" } });
    mocks.playAccountId.mockReturnValue("bound-account");
    mocks.createPlayPublisherClient.mockReturnValue(publisher);
  });

  it("grants one replayed purchase once through the route and real ledger functions", async () => {
    mocks.redisCommand
      .mockResolvedValueOnce([1, 10])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([0, 10])
      .mockResolvedValueOnce(1);

    const first = await POST(request());
    const replay = await POST(request());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ status: "granted", balance: 10 });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual({ status: "already_granted", balance: 10 });
    expect(publisher.consumeProductPurchase).toHaveBeenCalledTimes(2);
    expect(mocks.redisCommand).toHaveBeenCalledTimes(4);
    const claimCommands = mocks.redisCommand.mock.calls
      .map(([command]) => command as unknown[])
      .filter((command) => command[0] === "EVAL" && String(command[1]).includes("INCRBY"));
    expect(claimCommands).toHaveLength(2);
    expect(JSON.stringify(claimCommands)).not.toContain(token);
  });

  it("preserves one grant when two requests race for the same token", async () => {
    mocks.redisCommand
      .mockResolvedValueOnce([1, 10])
      .mockResolvedValueOnce([0, 10])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const [first, second] = await Promise.all([POST(request()), POST(request())]);
    const bodies = await Promise.all([first.json(), second.json()]);

    expect(bodies).toEqual(expect.arrayContaining([
      { status: "granted", balance: 10 },
      { status: "already_granted", balance: 10 },
    ]));
    expect(publisher.consumeProductPurchase).toHaveBeenCalledTimes(2);
  });

  it("rejects a token already owned by another account without crediting it", async () => {
    mocks.redisCommand.mockResolvedValue([-1, 0]);

    const response = await POST(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "purchase_account_mismatch" });
    expect(publisher.consumeProductPurchase).not.toHaveBeenCalled();
  });
});
