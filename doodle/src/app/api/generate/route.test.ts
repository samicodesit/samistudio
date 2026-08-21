import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationError } from "@/lib/generation/generate-doodle";
import { POST } from "./route";

const trialIdentity = { id: "trial" };
const png = { bytes: Buffer.from("png"), mimeType: "image/png" as const };

const mocks = vi.hoisted(() => ({
  checkBotId: vi.fn(),
  checkGenerationLimit: vi.fn(),
  finalizeFreeDoodle: vi.fn(),
  generateDoodle: vi.fn(),
  getCurrentUser: vi.fn(),
  getTrialIdentity: vi.fn(),
  refundFreeDoodle: vi.fn(),
  refundPaidCredit: vi.fn(),
  reserveFreeDoodle: vi.fn(),
  reservePaidCredit: vi.fn(),
  setTrialCookie: vi.fn(),
}));

vi.mock("@/lib/generation/generate-doodle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generation/generate-doodle")>("@/lib/generation/generate-doodle");
  return { ...actual, generateDoodle: mocks.generateDoodle };
});
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/billing/credits", () => ({
  refundPaidCredit: mocks.refundPaidCredit,
  reservePaidCredit: mocks.reservePaidCredit,
}));
vi.mock("@/lib/generation/free-allowance", () => ({
  finalizeFreeDoodle: mocks.finalizeFreeDoodle,
  getTrialIdentity: mocks.getTrialIdentity,
  refundFreeDoodle: mocks.refundFreeDoodle,
  reserveFreeDoodle: mocks.reserveFreeDoodle,
  setTrialCookie: mocks.setTrialCookie,
}));
vi.mock("@/lib/generation/generation-limit", () => ({ checkGenerationLimit: mocks.checkGenerationLimit }));
vi.mock("botid/server", () => ({ checkBotId: mocks.checkBotId }));

function request(scene: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { host: "localhost:3000", origin, "content-type": "application/json" },
    body: JSON.stringify({ scene }),
  });
}

function malformedRequest() {
  return new NextRequest("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" },
    body: "{",
  });
}

function expectNoReservation() {
  expect(mocks.reservePaidCredit).not.toHaveBeenCalled();
  expect(mocks.reserveFreeDoodle).not.toHaveBeenCalled();
}

describe("generate route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.checkBotId.mockResolvedValue({ isBot: false });
    mocks.checkGenerationLimit.mockResolvedValue("allowed");
    mocks.finalizeFreeDoodle.mockResolvedValue(1);
    mocks.generateDoodle.mockResolvedValue(png);
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.getTrialIdentity.mockReturnValue(trialIdentity);
    mocks.refundFreeDoodle.mockResolvedValue(1);
    mocks.refundPaidCredit.mockResolvedValue(10);
    mocks.reserveFreeDoodle.mockResolvedValue({ reserved: true, remaining: 1 });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: false, remaining: 0 });
    mocks.setTrialCookie.mockImplementation((response: NextResponse) => {
      response.cookies.set("doodle_trial", "signed", { httpOnly: true, sameSite: "lax", path: "/" });
    });
  });

  it("rejects a cross-origin request before BotID and reservation", async () => {
    const response = await POST(request("Two cats hug", "https://evil.example"));

    expect(response.status).toBe(403);
    expect(mocks.checkBotId).not.toHaveBeenCalled();
    expectNoReservation();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("rejects a detected bot before reservation", async () => {
    mocks.checkBotId.mockResolvedValue({ isBot: true });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "bot_detected" });
    expectNoReservation();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("fails closed when BotID is unavailable", async () => {
    mocks.checkBotId.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expectNoReservation();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before reservation", async () => {
    const response = await POST(malformedRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_scene" });
    expectNoReservation();
  });

  it.each([" ", "x".repeat(181)])("rejects malformed scene %# before reservation", async (scene) => {
    const response = await POST(request(scene));

    expect(response.status).toBe(400);
    expectNoReservation();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("uses paid credit first and bypasses free accounting", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Doodle-Paid-Remaining")).toBe("9");
    expect(mocks.reservePaidCredit).toHaveBeenCalledWith("user", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(mocks.reserveFreeDoodle).not.toHaveBeenCalled();
    expect(mocks.checkGenerationLimit).not.toHaveBeenCalled();
    expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["signed out", null],
    ["paid balance is empty", { id: "user", email: "buyer@example.com" }],
  ])("uses free allowance when %s", async (_case, user) => {
    mocks.getCurrentUser.mockResolvedValue(user);

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Doodle-Free-Remaining")).toBe("1");
    expect(response.headers.get("set-cookie")).toContain("doodle_trial=signed");
    expect(mocks.reserveFreeDoodle).toHaveBeenCalledWith(trialIdentity, expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(mocks.checkGenerationLimit).toHaveBeenCalledOnce();
    expect(mocks.finalizeFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.refundFreeDoodle).not.toHaveBeenCalled();
    expect(mocks.reservePaidCredit).toHaveBeenCalledTimes(user ? 1 : 0);
  });

  it("returns payment_required with the trial cookie before OpenAI when free allowance is empty", async () => {
    mocks.reserveFreeDoodle.mockResolvedValue({ reserved: false, remaining: 0 });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "payment_required" });
    expect(response.headers.get("X-Doodle-Free-Remaining")).toBe("0");
    expect(response.headers.get("set-cookie")).toContain("doodle_trial=signed");
    expect(mocks.checkGenerationLimit).not.toHaveBeenCalled();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
    expect(mocks.refundFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["rate_limited", 429, "rate_limited"],
    ["unavailable", 503, "limit_unavailable"],
  ])("refunds a free reservation once when the daily limit is %s", async (limit, status, code) => {
    mocks.checkGenerationLimit.mockResolvedValue(limit);

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(mocks.refundFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.refundFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("refunds a free reservation when the daily limit throws", async () => {
    mocks.checkGenerationLimit.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(mocks.refundFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["refused", 422],
    ["timeout", 504],
    ["upstream", 502],
    ["malformed", 502],
  ] as const)("refunds paid %s failures once", async (kind, status) => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.generateDoodle.mockRejectedValue(new GenerationError(kind, "failed"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reservePaidCredit.mock.calls[0][1];

    expect(response.status).toBe(status);
    expect(mocks.refundPaidCredit).toHaveBeenCalledOnce();
    expect(mocks.refundPaidCredit).toHaveBeenCalledWith("user", reservationId);
    expect(mocks.refundFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["refused", 422],
    ["timeout", 504],
    ["upstream", 502],
    ["malformed", 502],
  ] as const)("refunds free %s failures once", async (kind, status) => {
    mocks.generateDoodle.mockRejectedValue(new GenerationError(kind, "failed"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(status);
    expect(mocks.refundFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.refundFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([new Error("offline"), 0])("refunds once and returns 503 when free finalization fails with %s", async (failure) => {
    if (failure instanceof Error) mocks.finalizeFreeDoodle.mockRejectedValue(failure);
    else mocks.finalizeFreeDoodle.mockResolvedValue(failure);

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(mocks.refundFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.refundFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
  });

  it.each([
    ["paid", { id: "user", email: "buyer@example.com" }],
    ["free", null],
  ])("refunds a %s reservation when response construction fails", async (kind, user) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    if (user) mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.generateDoodle.mockResolvedValue({ bytes: null, mimeType: "image/png" });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(502);
    if (kind === "paid") expect(mocks.refundPaidCredit).toHaveBeenCalledOnce();
    else {
      expect(mocks.refundFreeDoodle).toHaveBeenCalledOnce();
      expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
    }
  });

  it("refunds a free reservation when writing its trial cookie fails", async () => {
    mocks.setTrialCookie.mockImplementation(() => { throw new Error("cookie failure"); });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(mocks.refundFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
  });

  it("keeps the mapped failure when the matching refund is unavailable", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.generateDoodle.mockRejectedValue(new GenerationError("refused", "failed"));
    mocks.refundPaidCredit.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(422);
    expect(mocks.refundPaidCredit).toHaveBeenCalledOnce();
  });

  it("fails closed when the session lookup is unavailable", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expectNoReservation();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("fails closed instead of falling back when paid reservation is unavailable", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(mocks.reserveFreeDoodle).not.toHaveBeenCalled();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it.each(["identity", "reservation"])("fails closed when free %s infrastructure is unavailable", async (failure) => {
    if (failure === "identity") mocks.getTrialIdentity.mockImplementation(() => { throw new Error("offline"); });
    else mocks.reserveFreeDoodle.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(mocks.checkGenerationLimit).not.toHaveBeenCalled();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("returns a PNG without caching on success", async () => {
    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("png");
  });
});
