import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  fulfillCheckout: vi.fn(),
  fulfillCheckoutDetails: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/billing/checkout", () => ({ fulfillCheckout: mocks.fulfillCheckout, fulfillCheckoutDetails:mocks.fulfillCheckoutDetails }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

function request(body?: unknown, origin = "https://doodle.test", query = "") {
  return new NextRequest("https://doodle.test/api/checkout/confirm" + query, {
    method: "POST",
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("checkout confirmation route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
  });

  it("rejects cross-origin confirmation before authentication", async () => {
    const response = await POST(request({ sessionId: "cs_paid" }, "https://evil.test"));

    expect(response.status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("does not treat a query session ID as payment proof", async () => {
    const response = await POST(request(undefined, "https://doodle.test", "?sessionId=cs_query"));

    expect(response.status).toBe(400);
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("requires authentication before fulfillment", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request({ sessionId: "cs_paid" }));

    expect(response.status).toBe(401);
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("retrieves and validates the session for the authenticated user", async () => {
    mocks.fulfillCheckout.mockResolvedValue(10);

    const response = await POST(request({ sessionId: "cs_paid" }));

    expect(await response.json()).toEqual({ balance: 10 });
    expect(mocks.fulfillCheckout).toHaveBeenCalledWith("cs_paid", "user");
  });

  it("does not report a balance when session validation or billing fails", async () => {
    mocks.fulfillCheckout.mockRejectedValue(new Error("session does not match"));

    const response = await POST(request({ sessionId: "cs_untrusted" }));

    expect(response.status).toBe(503);
  });
});

it("returns the original grant details to the new web client",async()=>{mocks.getCurrentUser.mockResolvedValue({id:"user"});mocks.fulfillCheckoutDetails.mockResolvedValue({balance:25,productId:"pack_regular",creditsGranted:25,offerApplied:true});const req=request({sessionId:"cs_paid"});req.headers.set("x-doodle-packs","v1");const response=await POST(req);expect(await response.json()).toEqual({balance:25,productId:"pack_regular",creditsGranted:25,offerApplied:true});expect(response.headers.get("cache-control")).toBe("no-store");});

it("reports pending completion without inventing a successful credit grant",async()=>{mocks.getCurrentUser.mockResolvedValue({id:"user"});mocks.fulfillCheckoutDetails.mockRejectedValue(new Error("checkout_pending"));const req=request({sessionId:"cs_pending"});req.headers.set("x-doodle-packs","v1");const response=await POST(req);expect(response.status).toBe(202);expect(await response.json()).toEqual({pending:true});});

it("distinguishes a terminal payment failure from pending or temporary errors",async()=>{
 mocks.getCurrentUser.mockResolvedValue({id:"user"});mocks.fulfillCheckoutDetails.mockRejectedValue(new Error("checkout_failed"));const req=request({sessionId:"cs_failed"});req.headers.set("x-doodle-packs","v1");
 const response=await POST(req);expect(response.status).toBe(409);expect(await response.json()).toEqual({error:"checkout_failed"});
});
