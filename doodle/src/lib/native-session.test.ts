import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeSession, getNativeBearer, getNativeSessionUser, revokeNativeSession } from "./native-session";
import { NativeRequestError, hasExactKeys, readNativeJson } from "./native-contracts";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ redisCommand: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.redisCommand }));

const USER = {
  id: "a6c1f149-6239-4b77-8d3f-7a0574bb5f40",
  identityKey: "a".repeat(64),
  email: "buyer@example.com",
};

function request(headers: Record<string, string> = {}) {
  return new Request("https://doodle.samistudio.nl/api/account", { headers });
}

describe("native request contracts", () => {
  it("accepts only an exact object key set", () => {
    expect(hasExactKeys({ credential: "token" }, ["credential"])).toBe(true);
    expect(hasExactKeys({ credential: "token", extra: true }, ["credential"])).toBe(false);
  });

  it("bounds declared and actual request bodies", async () => {
    await expect(readNativeJson(new Request("https://doodle.test", {
      method: "POST",
      headers: { "content-length": "9" },
      body: "{}",
    }), 8)).rejects.toMatchObject({ code: "body_too_large" } satisfies Partial<NativeRequestError>);

    await expect(readNativeJson(new Request("https://doodle.test", {
      method: "POST",
      body: JSON.stringify({ value: "123456789" }),
    }), 8)).rejects.toMatchObject({ code: "body_too_large" });
  });

  it("rejects malformed JSON and non-object JSON", async () => {
    await expect(readNativeJson(new Request("https://doodle.test", { method: "POST", body: "{" }), 100)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(readNativeJson(new Request("https://doodle.test", { method: "POST", body: "[]" }), 100)).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("distinguishes no bearer, valid bearer, and malformed bearer", () => {
    const token = "a".repeat(43);
    expect(getNativeBearer(request())).toBeUndefined();
    expect(getNativeBearer(request({ authorization: "Bearer " + token }))).toBe(token);
    expect(getNativeBearer(request({ authorization: "Bearer short" }))).toBeNull();
    expect(getNativeBearer(request({ authorization: "Basic " + token }))).toBeNull();
  });
});

describe("native Redis sessions", () => {
  it("accepts absent display email only for an explicit Apple identity", async () => {
    await expect(createNativeSession({ ...USER, provider: "apple", email: null, appleAuthenticatedAt: 100 })).resolves.toHaveProperty("accessToken");
    await expect(createNativeSession({ ...USER, email: null })).rejects.toThrow("Invalid native session user");
    mocks.redisCommand.mockResolvedValueOnce(JSON.stringify({ ...USER, provider: "apple", email: null, appleAuthenticatedAt: 100 }));
    await expect(getNativeSessionUser("b".repeat(43))).resolves.toMatchObject({ provider: "apple", email: null, appleAuthenticatedAt: 100 });
    mocks.redisCommand.mockResolvedValueOnce(JSON.stringify({ ...USER, provider: "untrusted" }));
    await expect(getNativeSessionUser("b".repeat(43))).resolves.toBeNull();
  });

  beforeEach(() => {
    mocks.redisCommand.mockReset();
    mocks.redisCommand.mockResolvedValue(1);
  });

  it("stores a random opaque token with the cookie session TTL", async () => {
    const result = await createNativeSession(USER);
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(mocks.redisCommand).toHaveBeenCalledWith([
      "EVAL", expect.any(String), "5",
      expect.stringMatching(/^doodle:auth:native:[a-f0-9]{64}$/),
      `doodle:account:${USER.id}:active`,
      `doodle:account:${USER.id}:deleted`,
      `doodle:account:${USER.id}:native-sessions`,
      `doodle:auth:apple:${USER.identityKey}:state`,
      JSON.stringify(USER),
      2_592_000,
      "google", 0,
    ]);
  });

  it("loads only a valid stored user", async () => {
    const token = "b".repeat(43);
    mocks.redisCommand.mockResolvedValueOnce(JSON.stringify(USER));
    await expect(getNativeSessionUser(token)).resolves.toEqual(USER);

    mocks.redisCommand.mockResolvedValueOnce(JSON.stringify({ ...USER, identityKey: "bad" }));
    await expect(getNativeSessionUser(token)).resolves.toBeNull();
  });

  it("revokes a valid bearer and ignores absent or malformed values", async () => {
    const token = "c".repeat(43);
    await revokeNativeSession(request({ authorization: "Bearer " + token }));
    expect(mocks.redisCommand).toHaveBeenCalledWith([
      "DEL",
      expect.stringMatching(/^doodle:auth:native:[a-f0-9]{64}$/),
    ]);

    mocks.redisCommand.mockClear();
    await revokeNativeSession(request());
    await revokeNativeSession(request({ authorization: "Bearer short" }));
    expect(mocks.redisCommand).not.toHaveBeenCalled();
  });
});
