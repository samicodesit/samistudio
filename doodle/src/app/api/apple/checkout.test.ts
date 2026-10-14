import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./config/route";
import { POST as intent } from "./intent/route";
import { POST as verify } from "./verify/route";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), config: vi.fn(), intent: vi.fn(), lookup: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/billing/apple-config", () => ({ getAppleBillingConfig: mocks.config }));
vi.mock("@/lib/billing/apple-purchase", async original => ({ ...await original<typeof import("@/lib/billing/apple-purchase")>(), createApplePurchaseLookup: () => mocks.lookup }));
vi.mock("@/lib/billing/apple-credits", async original => ({ ...await original<typeof import("@/lib/billing/apple-credits")>(), createAppleIntent: mocks.intent, claimAppleCredits: mocks.claim }));
const base = "https://doodle.samistudio.nl";
const token = "11111111-1111-4111-8111-111111111111";
const req = (path: string, body: unknown, origin = base) => new Request(base + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  mocks.user.mockResolvedValue({ id: token }); mocks.config.mockReturnValue({ environment: "Sandbox" });
  mocks.intent.mockResolvedValue({ productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false, appAccountToken: token });
  mocks.lookup.mockResolvedValue({ transactionId: "200000000000001", productId: "pack_mini", appAccountToken: token });
  mocks.claim.mockResolvedValue({ status: "granted", balance: 6, creditsGranted: 6, offerApplied: false });
});
describe("Apple checkout API", () => {
  it("requires sign-in for configuration, intent and verification", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await GET(new Request(base + "/api/apple/config"))).status).toBe(401);
    expect((await intent(req("/api/apple/intent", { productId: "pack_mini", expectedCredits: 6 }))).status).toBe(401);
    expect((await verify(req("/api/apple/verify", { transactionId: "200000000000001" }))).status).toBe(401);
  });
  it("keeps checkout unavailable until configured and returns no secrets", async () => {
    mocks.config.mockReturnValue(null);
    expect((await GET(new Request(base + "/api/apple/config"))).status).toBe(503);
    expect((await intent(req("/api/apple/intent", { productId: "pack_mini", expectedCredits: 6 }))).status).toBe(503);
    mocks.config.mockReturnValue({ environment: "Sandbox", privateKey: "private", issuerId: "private" });
    const response = await GET(new Request(base + "/api/apple/config"));
    expect(await response.json()).toMatchObject({ enabled: true, environment: "Sandbox", version: 1 });
    expect(JSON.stringify(await (await GET(new Request(base + "/api/apple/config"))).json())).not.toContain("private");
  });
  it("rejects cross-origin writes and malformed or oversized input", async () => {
    expect((await intent(req("/api/apple/intent", { productId: "pack_mini", expectedCredits: 6 }, "https://evil.test"))).status).toBe(403);
    for (const body of [{ transactionId: "" }, { transactionId: "200000000000001", balance: 99 }, { transactionId: "x".repeat(5000) }]) {
      expect((await verify(req("/api/apple/verify", body))).status).toBe(body.transactionId.length > 4096 ? 413 : 400);
    }
  });
  it("creates the server-owned quantity promise and reports offer changes", async () => {
    expect(await (await intent(req("/api/apple/intent", { productId: "pack_mini", expectedCredits: 6 }))).json()).toMatchObject({ credits: 6, appAccountToken: token });
    mocks.intent.mockRejectedValue(new Error("offer_changed"));
    expect((await intent(req("/api/apple/intent", { productId: "pack_mini", expectedCredits: 6 }))).status).toBe(409);
  });
  it("returns delivery confirmation bound to the verified transaction", async () => {
    const response = await verify(req("/api/apple/verify", { transactionId: "200000000000001" }));
    expect(await response.json()).toEqual({ status: "granted", balance: 6, creditsGranted: 6, offerApplied: false, productId: "pack_mini", checkoutReference: token });
    mocks.claim.mockRejectedValue(new Error("Redis unavailable"));
    expect((await verify(req("/api/apple/verify", { transactionId: "200000000000001" }))).status).toBe(503);
  });
});
