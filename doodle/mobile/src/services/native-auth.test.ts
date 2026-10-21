import { describe, expect, it, vi } from "vitest";
import { NativeAuthService } from "./native-auth";

describe("native login provider selection", () => {
  it("uses the selected identity provider without silently substituting another account", async () => {
    const googleIdentity = { authenticated: true as const, email: "google@example.com", accessToken: "g".repeat(43), expiresAt: Date.now() + 60_000 };
    const appleIdentity = { authenticated: true as const, provider: "apple" as const, email: null, accessToken: "a".repeat(43), expiresAt: Date.now() + 60_000 };
    const google = { signIn: vi.fn().mockResolvedValue(googleIdentity), signOut: vi.fn() };
    const apple = { signIn: vi.fn().mockResolvedValue(appleIdentity), isAvailable: vi.fn().mockResolvedValue(true) };
    const service = new NativeAuthService(google, apple);
    await expect(service.signIn("apple")).resolves.toEqual(appleIdentity);
    expect(google.signIn).not.toHaveBeenCalled();
    await expect(service.signIn()).resolves.toEqual(googleIdentity);
  });
  it("never falls back to Google when Apple sign-in is unavailable", async () => {
    const google = { signIn: vi.fn(), signOut: vi.fn() };
    const service = new NativeAuthService(google);
    await expect(service.signIn("apple")).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(google.signIn).not.toHaveBeenCalled();
  });
});
