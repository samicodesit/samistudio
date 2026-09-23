import { describe, expect, it, vi } from "vitest";
import { GoogleAuthService, type GoogleSignInApi } from "./auth";

function googleModule(response: any): GoogleSignInApi {
  return {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue(response),
    signOut: vi.fn().mockResolvedValue(null),
  };
}

describe("GoogleAuthService", () => {
  it("configures the native SDK for the public web audience and exchanges only the ID token", async () => {
    const google = googleModule({ type: "success", data: { idToken: "google-id-token" } });
    const signInWithGoogle = vi.fn().mockResolvedValue({ authenticated: true, email: "sam@example.com", accessToken: "a".repeat(43), expiresAt: Date.now() + 60_000 });
    const service = new GoogleAuthService({ google, webClientId: "123.apps.googleusercontent.com", signInWithGoogle });

    await service.signIn();

    expect(google.configure).toHaveBeenCalledWith({ webClientId: "123.apps.googleusercontent.com", offlineAccess: false });
    expect(google.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
    expect(signInWithGoogle).toHaveBeenCalledWith("google-id-token");
  });

  it("fails closed when the SDK does not return an ID token", async () => {
    const signInWithGoogle = vi.fn();
    const service = new GoogleAuthService({ google: googleModule({ type: "success", data: { idToken: null } }), webClientId: "123.apps.googleusercontent.com", signInWithGoogle });

    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it("does not treat user cancellation as a successful session", async () => {
    const signInWithGoogle = vi.fn();
    const service = new GoogleAuthService({ google: googleModule({ type: "cancelled", data: null }), webClientId: "123.apps.googleusercontent.com", signInWithGoogle });

    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_cancelled" });
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });
});
