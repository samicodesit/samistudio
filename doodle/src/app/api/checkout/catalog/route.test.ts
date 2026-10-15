import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/billing/web-packs", () => ({ getWebPackCatalog: mocks.catalog, checkWebCatalogLimit: mocks.limit }));
beforeEach(() => {
  vi.stubEnv("STRIPE_PACKS_CHECKOUT_ENABLED", "true");
  mocks.catalog.mockReset().mockResolvedValue({ offerEnd: "2026-10-31T23:59:59+01:00", packs: [] });
  mocks.limit.mockReset().mockResolvedValue("allowed");
});
const request = () => new Request("https://doodle.example/api/checkout/catalog");
it("returns a fresh offer without browser caching", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ offerEnd: "2026-10-31T23:59:59+01:00" });
});
it.each([["rate_limited", 429], ["unavailable", 503]])("stops %s catalog requests before calling Stripe", async (status, code) => {
  mocks.limit.mockResolvedValue(status);
  const response = await GET(request());
  expect(response.status).toBe(code);
  expect(mocks.catalog).not.toHaveBeenCalled();
});
it("disabled rollout makes no catalog or limiter calls", async () => {
  vi.stubEnv("STRIPE_PACKS_CHECKOUT_ENABLED", "false");
  expect((await GET(request())).status).toBe(503);
  expect(mocks.catalog).not.toHaveBeenCalled();
  expect(mocks.limit).not.toHaveBeenCalled();
});
