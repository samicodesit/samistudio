import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyGoogleCredential } from "./google";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class { verifyIdToken = mocks.verifyIdToken },
}));

describe("Google credential verification", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-id");
    mocks.verifyIdToken.mockReset();
  });

  it("returns only a verified Google subject and email", async () => {
    mocks.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: "google-sub", email: "buyer@gmail.com", email_verified: true }) });

    await expect(verifyGoogleCredential("credential")).resolves.toEqual({ sub: "google-sub", email: "buyer@gmail.com" });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith({ idToken: "credential", audience: "google-client-id" });
  });

  it.each([
    ["is empty", ""],
    ["is too large", "x".repeat(8193)],
  ])("rejects a credential that %s", async (_name, credential) => {
    await expect(verifyGoogleCredential(credential)).rejects.toThrow("Invalid Google credential");
  });

  it.each([
    [{ email: "buyer@gmail.com", email_verified: true }],
    [{ sub: "google-sub", email_verified: true }],
    [{ sub: "google-sub", email: "buyer@gmail.com", email_verified: false }],
  ])("fails closed for incomplete verified payloads", async (payload) => {
    mocks.verifyIdToken.mockResolvedValue({ getPayload: () => payload });

    await expect(verifyGoogleCredential("credential")).rejects.toThrow("Invalid Google credential");
  });

  it("normalizes Google verification errors", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("wrong audience or expired"));

    await expect(verifyGoogleCredential("credential")).rejects.toThrow("Invalid Google credential");
  });
});
