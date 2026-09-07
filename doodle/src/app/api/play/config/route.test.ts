import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getPlayBillingConfig: vi.fn(), playAccountId: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/billing/play-config", () => ({ getPlayBillingConfig: mocks.getPlayBillingConfig, playAccountId: mocks.playAccountId }));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getCurrentUser.mockResolvedValue({ id: "account-id" });
  mocks.playAccountId.mockReturnValue("a".repeat(64));
});

describe("Play config route", () => {
  it("requires an authenticated account", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getPlayBillingConfig).not.toHaveBeenCalled();
  });
  it("fails closed while disabled", async () => {
    mocks.getPlayBillingConfig.mockReturnValue(null);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "play_unavailable" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not expose configuration error details", async () => {
    mocks.getPlayBillingConfig.mockImplementation(() => { throw new Error("private-key-secret"); });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "play_unavailable" });
  });
  it("returns only fixed product and account binding without credentials", async () => {
    mocks.getPlayBillingConfig.mockReturnValue({ productId: "doodle_credits_10", packageName: "nl.samistudio.doodle", credentials: { private_key: "secret" } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: "a".repeat(64) });
    expect(mocks.playAccountId).toHaveBeenCalledWith("account-id");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
