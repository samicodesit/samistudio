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
  finalizePaidCredit: vi.fn(),
  generateDoodle: vi.fn(),
  getCurrentUser: vi.fn(),
  getTrialIdentity: vi.fn(),
  releaseFreeDoodle: vi.fn(),
  releasePaidCredit: vi.fn(),
  reserveFreeDoodle: vi.fn(),
  reservePaidCredit: vi.fn(),
  setTrialCookie: vi.fn(),
}));

vi.mock("@/lib/generation/generate-doodle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generation/generate-doodle")>("@/lib/generation/generate-doodle");
  return { ...actual, generateDoodle: mocks.generateDoodle };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/billing/credits", () => ({
  finalizePaidCredit: mocks.finalizePaidCredit,
  releasePaidCredit: mocks.releasePaidCredit,
  reservePaidCredit: mocks.reservePaidCredit,
}));
vi.mock("@/lib/generation/free-allowance", () => ({
  finalizeFreeDoodle: mocks.finalizeFreeDoodle,
  getTrialIdentity: mocks.getTrialIdentity,
  releaseFreeDoodle: mocks.releaseFreeDoodle,
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
    mocks.finalizeFreeDoodle.mockResolvedValue({ finalized: true, remaining: 1 });
    mocks.finalizePaidCredit.mockResolvedValue({ finalized: true, remaining: 9 });
    mocks.generateDoodle.mockResolvedValue(png);
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.getTrialIdentity.mockReturnValue(trialIdentity);
    mocks.releaseFreeDoodle.mockResolvedValue(1);
    mocks.releasePaidCredit.mockResolvedValue(1);
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
    expect(mocks.finalizePaidCredit).toHaveBeenCalledWith("user", mocks.reservePaidCredit.mock.calls[0][1]);
    expect(mocks.reserveFreeDoodle).not.toHaveBeenCalled();
    expect(mocks.checkGenerationLimit).not.toHaveBeenCalled();
    expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
  });

  it("uses finalized permanent paid balance in the success header", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 8 });
    mocks.finalizePaidCredit.mockResolvedValue({ finalized: true, remaining: 9 });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Doodle-Paid-Remaining")).toBe("9");
  });

  it("uses finalized permanent free balance in the success header", async () => {
    mocks.reserveFreeDoodle.mockResolvedValue({ reserved: true, remaining: 0 });
    mocks.finalizeFreeDoodle.mockResolvedValue({ finalized: true, remaining: 1 });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Doodle-Free-Remaining")).toBe("1");
  });

  it.each([
    ["paid", { id: "user", email: "buyer@example.com" }],
    ["free", null],
  ])("delivers the generated PNG when %s finalization stays ambiguous", async (kind, user) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    if (user) {
      mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
      mocks.finalizePaidCredit.mockRejectedValue(new Error("response lost"));
    } else {
      mocks.finalizeFreeDoodle.mockRejectedValue(new Error("response lost"));
    }

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Doodle-Balance-Uncertain")).toBe("1");
    expect(response.headers.get("X-Doodle-Paid-Remaining")).toBeNull();
    expect(response.headers.get("X-Doodle-Free-Remaining")).toBeNull();
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("png");
    if (kind === "paid") {
      expect(mocks.finalizePaidCredit).toHaveBeenCalledTimes(2);
      expect(mocks.releasePaidCredit).not.toHaveBeenCalled();
    } else {
      expect(mocks.finalizeFreeDoodle).toHaveBeenCalledTimes(2);
      expect(response.headers.get("set-cookie")).toContain("doodle_trial=signed");
      expect(mocks.releaseFreeDoodle).not.toHaveBeenCalled();
    }
  });

  it("retries an ambiguous paid finalization and returns an exact balance when replay resolves it", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.finalizePaidCredit
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ finalized: true, remaining: 9 });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Doodle-Paid-Remaining")).toBe("9");
    expect(response.headers.get("X-Doodle-Balance-Uncertain")).toBeNull();
    expect(mocks.finalizePaidCredit).toHaveBeenCalledTimes(2);
    expect(mocks.releasePaidCredit).not.toHaveBeenCalled();
  });

  it.each([
    ["paid", { id: "user", email: "buyer@example.com" }],
    ["free", null],
  ])("returns 503 without an image when %s finalization is explicitly uncharged", async (kind, user) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    if (user) {
      mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
      mocks.finalizePaidCredit
        .mockRejectedValueOnce(new Error("response lost"))
        .mockResolvedValueOnce({ finalized: false, remaining: 9 });
    } else {
      mocks.finalizeFreeDoodle.mockResolvedValue({ finalized: false, remaining: 2 });
    }

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(response.headers.get("X-Doodle-Balance-Uncertain")).toBeNull();
    if (kind === "paid") {
      expect(mocks.finalizePaidCredit).toHaveBeenCalledTimes(2);
      expect(mocks.releasePaidCredit).toHaveBeenCalledOnce();
    } else {
      expect(mocks.finalizeFreeDoodle).toHaveBeenCalledOnce();
      expect(mocks.releaseFreeDoodle).toHaveBeenCalledOnce();
    }
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
    expect(mocks.releaseFreeDoodle).not.toHaveBeenCalled();
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
    expect(mocks.releaseFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["rate_limited", 429, "rate_limited"],
    ["unavailable", 503, "limit_unavailable"],
  ])("releases a free hold once when the daily limit is %s", async (limit, status, code) => {
    mocks.checkGenerationLimit.mockResolvedValue(limit);

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("releases a free hold when the daily limit throws", async () => {
    mocks.checkGenerationLimit.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["refused", 422],
    ["timeout", 504],
    ["upstream", 502],
    ["malformed", 502],
  ] as const)("releases paid %s failures once", async (kind, status) => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.generateDoodle.mockRejectedValue(new GenerationError(kind, "failed"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reservePaidCredit.mock.calls[0][1];

    expect(response.status).toBe(status);
    expect(mocks.releasePaidCredit).toHaveBeenCalledOnce();
    expect(mocks.releasePaidCredit).toHaveBeenCalledWith("user", reservationId);
    expect(mocks.releaseFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["refused", 422],
    ["timeout", 504],
    ["upstream", 502],
    ["malformed", 502],
  ] as const)("releases free %s failures once", async (kind, status) => {
    mocks.generateDoodle.mockRejectedValue(new GenerationError(kind, "failed"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(status);
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
    expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
  });

  it.each([
    ["paid", { id: "user", email: "buyer@example.com" }],
    ["free", null],
  ])("releases a %s hold with 503 when post-generation response construction fails", async (kind, user) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    if (user) mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.generateDoodle.mockResolvedValue({ bytes: null, mimeType: "image/png" });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    if (kind === "paid") expect(mocks.releasePaidCredit).toHaveBeenCalledOnce();
    else {
      expect(mocks.releaseFreeDoodle).toHaveBeenCalledOnce();
      expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
    }
  });

  it("releases a free hold when writing its trial cookie fails", async () => {
    mocks.setTrialCookie.mockImplementation(() => { throw new Error("cookie failure"); });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.finalizeFreeDoodle).not.toHaveBeenCalled();
  });

  it("keeps the mapped failure when release is unavailable", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
    mocks.generateDoodle.mockRejectedValue(new GenerationError("refused", "failed"));
    mocks.releasePaidCredit.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(422);
    expect(mocks.releasePaidCredit).toHaveBeenCalledOnce();
  });

  it("fails closed when the session lookup is unavailable", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expectNoReservation();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("releases the same paid hold once when its reserve response is lost", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.reservePaidCredit.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reservePaidCredit.mock.calls[0][1];

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(mocks.releasePaidCredit).toHaveBeenCalledOnce();
    expect(mocks.releasePaidCredit).toHaveBeenCalledWith("user", reservationId);
    expect(mocks.reserveFreeDoodle).not.toHaveBeenCalled();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("returns 503 before reservation for a no-cookie request missing its signing secret", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    mocks.getTrialIdentity.mockImplementation((incoming: NextRequest) => {
      expect(incoming.cookies.get("doodle_trial")).toBeUndefined();
      throw new Error("SESSION_SECRET is required");
    });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expectNoReservation();
    expect(mocks.checkGenerationLimit).not.toHaveBeenCalled();
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("releases the same free hold once when its reserve response is lost", async () => {
    mocks.reserveFreeDoodle.mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));
    const reservationId = mocks.reserveFreeDoodle.mock.calls[0][1];

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledOnce();
    expect(mocks.releaseFreeDoodle).toHaveBeenCalledWith(trialIdentity, reservationId);
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
