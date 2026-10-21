import { describe, expect, it, vi } from "vitest";
import { AppleAuthService } from "./apple-auth";

function setup() {
  const apple = { isAvailable: vi.fn().mockResolvedValue(true), signIn: vi.fn().mockResolvedValue({ identityToken: "signed-token", authorizationCode: "one-time-code" }) };
  const exchange = vi.fn().mockResolvedValue({ authenticated: true, provider: "apple", email: null, accessToken: "a".repeat(43), expiresAt: Date.now() + 60_000 });
  const service = new AppleAuthService({ apple, randomNonce: async () => "a".repeat(64), sha256: async () => "b".repeat(64), exchange });
  return { apple, exchange, service };
}
describe("Apple native sign-in", () => {
  it("sends a nonce hash to Apple and exchanges the proof without requiring a newly returned name/email", async () => {
    const { apple, exchange, service } = setup();
    await expect(service.signIn()).resolves.toMatchObject({ authenticated: true, email: null });
    expect(apple.signIn).toHaveBeenCalledWith("b".repeat(64));
    expect(exchange).toHaveBeenCalledWith({ identityToken: "signed-token", authorizationCode: "one-time-code", nonce: "a".repeat(64) });
  });
  it("leaves canceled login without a server exchange", async () => {
    const { apple, exchange, service } = setup();
    apple.signIn.mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });
    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_cancelled" });
    expect(exchange).not.toHaveBeenCalled();
  });
  it("rejects missing credentials without exchanging an incomplete authorization", async () => {
    const { apple, exchange, service } = setup();
    apple.signIn.mockResolvedValueOnce({ identityToken: "signed-token", authorizationCode: null });
    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(exchange).not.toHaveBeenCalled();
  });
  it("does not launch Apple's controller when the service is unavailable", async () => {
    const { apple, exchange, service } = setup();
    apple.isAvailable.mockResolvedValueOnce(false);
    await expect(service.signIn()).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(apple.signIn).not.toHaveBeenCalled();
    expect(exchange).not.toHaveBeenCalled();
  });
});
