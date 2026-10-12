import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as catalog } from "./catalog/route";
import { POST as intent } from "./intent/route";
import { POST as paywall } from "./paywall/route";
import { signedTrialToken } from "@/lib/generation/free-allowance";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(), config: vi.fn(), binding: vi.fn(), intent: vi.fn(),
  balance: vi.fn(), free: vi.fn(), track: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/billing/play-config", () => ({ getPlayBillingConfig: mocks.config, playAccountId: mocks.binding }));
vi.mock("@/lib/billing/play-intents", () => ({ createPlayIntent: mocks.intent }));
vi.mock("@/lib/billing/credits", () => ({ getPaidBalance: mocks.balance }));
vi.mock("@/lib/funnel-metrics", () => ({ trackFunnel: mocks.track }));
vi.mock("@/lib/generation/free-allowance", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/generation/free-allowance")>(),
  getFreeRemaining: mocks.free,
}));
const account = { id: "11111111-1111-4111-8111-111111111111", email: "buyer@example.com" };
const trial = { id: "22222222-2222-4222-8222-222222222222" };
function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://doodle.samistudio.nl/api/play/" + path, {
    method: "POST", headers: { origin: "https://doodle.samistudio.nl", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SESSION_SECRET", "local-test-session-secret");
  vi.stubEnv("DOODLE_LAUNCH_DELAY_DAYS", "0");
  mocks.user.mockResolvedValue(account);
  mocks.config.mockReturnValue({ enabled: true });
  mocks.binding.mockReturnValue("a".repeat(64));
  mocks.intent.mockResolvedValue({ productId: "pack_regular", credits: 25, offerApplied: true, obfuscatedProfileId: "b".repeat(64) });
  mocks.balance.mockResolvedValue(0);
  mocks.free.mockResolvedValue(0);
});
describe("public Play catalog", () => {
  it("returns only public pack and schedule data without requiring an account", async () => {
    const response = catalog();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.packs.map((p: { productId: string }) => p.productId)).toEqual(["pack_mini", "pack_regular", "pack_big"]);
    expect(JSON.stringify(body)).not.toMatch(/account|credential|secret|priceLabel/i);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("fails closed for invalid schedule configuration", async () => {
    vi.stubEnv("DOODLE_LAUNCH_DELAY_DAYS", "invalid");
    const response = catalog();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "play_unavailable" });
  });
});
describe("authenticated pack checkout intent", () => {
  it("rejects foreign origins before creating an intent", async () => {
    expect((await intent(request("intent", {}, { origin: "https://attacker.test" }))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("requires sign-in", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await intent(request("intent", { productId: "pack_regular", expectedCredits: 25 }))).status).toBe(401);
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it.each([
    "{", [], { productId: "doodle_credits_10", expectedCredits: 10 },
    { productId: "pack_regular", expectedCredits: 25, accountId: "foreign" },
    { productId: "pack_regular", expectedCredits: 25.5 },
    { productId: "pack_regular", expectedCredits: "25" },
    '{"padding":"' + "x".repeat(1024) + '"}',
  ])("rejects malformed, unbounded or client-owned grant data: %j", async body => {
    expect((await intent(request("intent", body))).status).toBe(400);
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it("uses the signed-in account and returns the immutable checkout reference", async () => {
    const response = await intent(request("intent", { productId: "pack_regular", expectedCredits: 25 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ productId: "pack_regular", credits: 25, offerApplied: true, obfuscatedProfileId: "b".repeat(64), obfuscatedAccountId: "a".repeat(64) });
    expect(mocks.intent).toHaveBeenCalledWith(account.id, "pack_regular", 25);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([["offer_changed", 409], ["rate_limited", 429], ["packs_disabled", 503], ["internal secret", 503]])("maps %s without leaking internal errors", async (message, status) => {
    mocks.intent.mockRejectedValue(new Error(String(message)));
    const response = await intent(request("intent", { productId: "pack_regular", expectedCredits: 25 }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: status === 409 ? "offer_changed" : status === 429 ? "rate_limited" : "play_unavailable" });
  });
  it("does not create an intent while Play is unavailable", async () => {
    mocks.config.mockReturnValue(null);
    expect((await intent(request("intent", { productId: "pack_mini", expectedCredits: 6 }))).status).toBe(503);
    expect(mocks.intent).not.toHaveBeenCalled();
  });
});
describe("bounded paywall actions", () => {
  it.each([{ trigger: "other" }, { trigger: "get_more", actor: "spoof" }, "x".repeat(257)])("rejects unknown fields, triggers and oversized bodies: %j", async body => {
    expect((await paywall(request("paywall", body))).status).toBe(400);
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests", async () => {
    expect((await paywall(request("paywall", { trigger: "get_more" }, { origin: "https://attacker.test" }))).status).toBe(403);
  });
  it("rejects guests without a valid signed trial token", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await paywall(request("paywall", { trigger: "get_more" }, { "x-doodle-trial-token": trial.id + ".forged" }))).status).toBe(401);
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("accepts an exhausted trial and derives its identity from the signed token", async () => {
    mocks.user.mockResolvedValue(null);
    const response = await paywall(request("paywall", { trigger: "get_more" }, { "x-doodle-trial-token": signedTrialToken(trial) }));
    expect(response.status).toBe(200);
    expect(mocks.track).toHaveBeenCalledWith({ metric: "paywall_hit", actor: "trial:" + trial.id, email: undefined, trigger: "get_more" });
  });
  it("rejects a guest with free drawings still available", async () => {
    mocks.user.mockResolvedValue(null);
    mocks.free.mockResolvedValue(1);
    expect((await paywall(request("paywall", { trigger: "get_more" }, { "x-doodle-trial-token": signedTrialToken(trial) }))).status).toBe(409);
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("rejects an account with paid drawings available", async () => {
    mocks.balance.mockResolvedValue(1);
    expect((await paywall(request("paywall", { trigger: "tapped_create" }))).status).toBe(409);
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("rejects a signed-in account with retained free drawings", async () => {
    mocks.free.mockResolvedValue(2);
    expect((await paywall(request("paywall", { trigger: "get_more" }, { "x-doodle-trial-token": signedTrialToken(trial) }))).status).toBe(409);
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("accepts an exhausted signed-in account without client-supplied identity", async () => {
    const response = await paywall(request("paywall", { trigger: "tapped_create" }));
    expect(response.status).toBe(200);
    expect(mocks.track).toHaveBeenCalledWith({ metric: "paywall_hit", actor: "account:" + account.id, email: account.email, trigger: "tapped_create" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("reports metrics storage failure without exposing details", async () => {
    mocks.balance.mockRejectedValue(new Error("private storage key"));
    const response = await paywall(request("paywall", { trigger: "get_more" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "metrics_unavailable" });
  });
});
