import { signedTrialToken } from "@/lib/generation/free-allowance";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ verifyGoogleCredential: vi.fn(), createOrGetGoogleAccount: vi.fn(), mergeFunnelIdentity: vi.fn(), setSessionCookie: vi.fn() }));
vi.mock("@/lib/funnel-metrics",()=>({mergeFunnelIdentity:mocks.mergeFunnelIdentity}));
vi.mock("@/lib/auth/google", () => ({ verifyGoogleCredential: mocks.verifyGoogleCredential }));
vi.mock("@/lib/auth/accounts", () => ({ createOrGetGoogleAccount: mocks.createOrGetGoogleAccount }));
vi.mock("@/lib/auth/session", () => ({ setSessionCookie: mocks.setSessionCookie }));

function request(body: unknown, origin = "https://doodle.test") {
  return new NextRequest("https://doodle.test/api/auth/google", {
    method: "POST",
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Google auth route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("rejects cross-origin requests before reading a credential", async () => {
    const response = await POST(request({ credential: "token" }, "https://evil.test"));

    expect(response.status).toBe(403);
    expect(mocks.verifyGoogleCredential).not.toHaveBeenCalled();
  });

  it("rejects malformed credential payloads", async () => {
    const response = await POST(request({ credential: 42 }));

    expect(response.status).toBe(400);
    expect(mocks.verifyGoogleCredential).not.toHaveBeenCalled();
  });

  it("rejects an invalid Google credential", async () => {
    mocks.verifyGoogleCredential.mockRejectedValue(new Error("Invalid Google credential"));

    const response = await POST(request({ credential: "token" }));

    expect(response.status).toBe(401);
  });

  it("returns a controlled unavailable response when Redis fails", async () => {
    mocks.verifyGoogleCredential.mockResolvedValue({ sub: "google-sub", email: "buyer@example.com" });
    mocks.createOrGetGoogleAccount.mockRejectedValue(new Error("Redis unavailable"));

    const response = await POST(request({ credential: "token" }));

    expect(response.status).toBe(503);
  });

  it("sets a Doodle session after verified Google sign-in", async () => {
    mocks.verifyGoogleCredential.mockResolvedValue({ sub: "google-sub", email: "buyer@example.com" });
    mocks.createOrGetGoogleAccount.mockResolvedValue({ id: "a6c1f149-6239-4b77-8d3f-7a0574bb5f40", identityKey: "a".repeat(64) });

    const response = await POST(request({ credential: "token" }));

    expect(response.status).toBe(204);
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(response, {
      id: "a6c1f149-6239-4b77-8d3f-7a0574bb5f40",
      identityKey: "a".repeat(64),
      email: "buyer@example.com",
    });
  });
});

it("merges only a verified retained web trial after successful sign-in",async()=>{
 vi.stubEnv("SESSION_SECRET","local-secret-with-at-least-32-characters");mocks.verifyGoogleCredential.mockResolvedValue({sub:"google",email:"buyer@example.com"});mocks.createOrGetGoogleAccount.mockResolvedValue({id:"account",identityKey:"identity"});
 const trial={id:"11111111-1111-4111-8111-111111111111"}, req=request({credential:"token"});req.cookies.set("doodle_trial",signedTrialToken(trial));expect((await POST(req)).status).toBe(204);expect(mocks.mergeFunnelIdentity).toHaveBeenCalledWith("trial:"+trial.id,"account:account","buyer@example.com");mocks.mergeFunnelIdentity.mockClear();await POST(request({credential:"token"}));expect(mocks.mergeFunnelIdentity).not.toHaveBeenCalled();vi.unstubAllEnvs();
});
