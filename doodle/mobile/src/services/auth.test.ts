import { describe, expect, it, vi } from "vitest";
import { NativeApiClient } from "./api-client";
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
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const service = new GoogleAuthService({ google: googleModule({ type: "cancelled", data: null }), webClientId: "123.apps.googleusercontent.com", signInWithGoogle, diagnostics });

    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_cancelled" });
    expect(signInWithGoogle).not.toHaveBeenCalled();
    expect(diagnostics.record).not.toHaveBeenCalled();
  });

  it("records provider failures without including credentials", async () => {
    const google = googleModule({ type: "success", data: { idToken: null } });
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const service = new GoogleAuthService({ google, webClientId: "123.apps.googleusercontent.com", signInWithGoogle: vi.fn(), diagnostics });

    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "auth", stage: "google_sign_in", code: "auth_unavailable" }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("idToken");
  });

  it("keeps the Play Services provider code with the stable authentication error", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const google = googleModule({ type: "success", data: { idToken: "google-id-token" } });
    google.hasPlayServices = vi.fn().mockRejectedValue({ code: "PLAY_SERVICES_NOT_AVAILABLE", message: "private provider details" });
    const service = new GoogleAuthService({ google, webClientId: "123.apps.googleusercontent.com", signInWithGoogle: vi.fn(), diagnostics });

    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "auth", stage: "google_services", code: "auth_unavailable", providerCode: "PLAY_SERVICES_NOT_AVAILABLE" }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("private provider details");
  });

  it("keeps the sign-in provider code when the native SDK fails", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const google = googleModule({ type: "success", data: { idToken: "google-id-token" } });
    google.signIn = vi.fn().mockRejectedValue({ code: "SIGN_IN_REQUIRED" });
    const service = new GoogleAuthService({ google, webClientId: "123.apps.googleusercontent.com", signInWithGoogle: vi.fn(), diagnostics });

    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "auth", stage: "google_sign_in", code: "auth_unavailable", providerCode: "SIGN_IN_REQUIRED" }));
  });

  it("leaves API exchange failures to the correlated API diagnostic", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const api = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })),
      diagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000017",
    });
    const google = googleModule({ type: "success", data: { idToken: "google-id-token" } });
    const service = new GoogleAuthService({ google, webClientId: "123.apps.googleusercontent.com", signInWithGoogle: (credential) => api.signInWithGoogle(credential), diagnostics });

    await expect(service.signIn()).rejects.toMatchObject({ code: "unauthorized", status: 401 });
    expect(diagnostics.record).toHaveBeenCalledTimes(1);
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "auth", stage: "http_response", code: "unauthorized", status: 401, requestId: "00000000-0000-4000-8000-000000000017" }));
  });
});

