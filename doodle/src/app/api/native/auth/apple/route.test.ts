import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ verify: vi.fn(), exchange: vi.fn(), store: vi.fn(), config: vi.fn(), account: vi.fn(), session: vi.fn(), merge: vi.fn() }));
vi.mock("@/lib/auth/apple", () => ({ verifyAppleIdentityToken: mocks.verify }));
vi.mock("@/lib/auth/apple-tokens", () => ({ exchangeAppleAuthorizationCode: mocks.exchange, storeAppleAuthorization: mocks.store, getAppleSignInConfig: mocks.config }));
vi.mock("@/lib/auth/accounts", () => ({ createOrGetAppleAccount: mocks.account }));
vi.mock("@/lib/native-session", () => ({ createNativeSession: mocks.session }));
vi.mock("@/lib/funnel-metrics", () => ({ mergeFunnelIdentity: mocks.merge }));

const account = { id: "11111111-1111-4111-8111-111111111111", identityKey: "a".repeat(64) };
const credential = { identityToken: "signed-apple-token", authorizationCode: "one-time-code", nonce: "a".repeat(64) };
function request(body: unknown, origin = "https://doodle.samistudio.nl", client = "native-ios") {
  return new NextRequest("https://doodle.samistudio.nl/api/native/auth/apple", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Doodle-Client": client }, body: JSON.stringify(body) });
}
describe("native Apple authentication", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.verify.mockResolvedValue({ sub: "apple-subject", email: null, authenticatedAt: 100 });
    mocks.exchange.mockResolvedValue("test-refresh-token");
    mocks.account.mockResolvedValue(account);
    mocks.store.mockResolvedValue(undefined);
    mocks.session.mockResolvedValue({ accessToken: "a".repeat(43), expiresAt: 123 });
  });
  it("returns an opaque Apple session when repeat sign-in has no display email", async () => {
    const response = await POST(request(credential));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, provider: "apple", email: null, accessToken: "a".repeat(43), expiresAt: 123 });
    expect(mocks.verify).toHaveBeenCalledWith(credential.identityToken, credential.nonce);
    expect(mocks.exchange).toHaveBeenCalledWith(credential.authorizationCode, "apple-subject");
    expect(mocks.store).toHaveBeenCalledWith(account, "test-refresh-token", 100);
    expect(mocks.session).toHaveBeenCalledWith({ ...account, provider: "apple", email: null, appleAuthenticatedAt: 100 });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin, other platforms, extra keys and oversized requests before verification", async () => {
    expect((await POST(request(credential, "https://attacker.test"))).status).toBe(403);
    expect((await POST(request(credential, undefined, "native-android"))).status).toBe(400);
    expect((await POST(request({ ...credential, accountId: account.id }))).status).toBe(400);
    expect((await POST(request({ ...credential, identityToken: "x".repeat(20_000) }))).status).toBe(413);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("never creates an account or session for an invalid identity", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("invalid signature"));
    expect((await POST(request(credential))).status).toBe(401);
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("does not issue a session when durable revocation storage fails", async () => {
    mocks.store.mockRejectedValueOnce(new Error("private storage details"));
    const response = await POST(request(credential));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "auth_unavailable" });
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
