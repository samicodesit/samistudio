import { describe, expect, it, vi } from "vitest";
import { NativeApiClient } from "./api-client";

function response(body: unknown, init?: ResponseInit) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("NativeApiClient", () => {
  it("sends the native origin and bearer without relying on cookies", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      authenticated: true,
      email: "sam@example.com",
      balance: 3,
      freeRemaining: null,
    }));
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl/",
      fetchImpl,
      getAccessToken: async () => "a".repeat(43),
      getTrialToken: async () => null,
    });

    await client.getAccount();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://doodle.samistudio.nl/api/account");
    expect(init?.credentials).toBe("omit");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${"a".repeat(43)}`);
    expect(headers.get("Origin")).toBe("https://doodle.samistudio.nl");
    expect(headers.get("X-Doodle-Client")).toBe("native-android");
  });

  it("keeps a guest trial token explicit and omits authorization", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      authenticated: false,
      email: null,
      balance: 0,
      freeRemaining: 2,
    }));
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      getAccessToken: async () => null,
      getTrialToken: async () => "trial-token-123456789012345",
    });

    await client.getAccount();
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Doodle-Trial-Token")).toBe("trial-token-123456789012345");
    expect(headers.get("Authorization")).toBeNull();
  });

  it("maps a binary generation response and remaining headers", async () => {
    const png = new Uint8Array([137, 80, 78, 71]).buffer;
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(new Response(png, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "X-Doodle-Paid-Remaining": "8",
        },
      }));
    const stagePng = vi.fn().mockResolvedValue("file:///cache/doodle.png");
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      stagePng,
      getAccessToken: async () => "a".repeat(43),
      getTrialToken: async () => null,
      getInstallId: async () => "11111111-1111-4111-8111-111111111111",
      createChallenge: vi.fn().mockResolvedValue({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }),
      requestIntegrity: vi.fn().mockResolvedValue("integrity-token-123"),
    });

    const result = await client.generate("  Two cats hug  ");

    expect(result).toEqual({ imageUri: "file:///cache/doodle.png", paidRemaining: 8 });
    expect(stagePng).toHaveBeenCalledWith(png);
    const [, init] = fetchImpl.mock.calls[1] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ scene: "Two cats hug" });
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Doodle-Attestation-Challenge")).toBe("c".repeat(43));
    expect(headers.get("X-Doodle-Attestation-Token")).toBe("integrity-token-123");
    expect(headers.get("X-Doodle-Install-Id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("sends the signed guest trial token with the generation challenge", async () => {
    const png = new Uint8Array([137, 80, 78, 71]).buffer;
    const trialToken = "trial-token-123456789012345";
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(response({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }))
      .mockResolvedValueOnce(new Response(png, { status: 200, headers: { "Content-Type": "image/png" } }));
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      stagePng: vi.fn().mockResolvedValue("file:///cache/doodle.png"),
      getAccessToken: async () => null,
      getTrialToken: async () => trialToken,
      getInstallId: async () => "11111111-1111-4111-8111-111111111111",
      hashScene: vi.fn().mockResolvedValue("a".repeat(64)),
      requestIntegrity: vi.fn().mockResolvedValue("integrity-token-123"),
    });

    await client.generate("A guest scene");

    const [, challengeInit] = fetchImpl.mock.calls[1] ?? [];
    const challengeHeaders = new Headers(challengeInit?.headers);
    expect(challengeHeaders.get("X-Doodle-Trial-Token")).toBe(trialToken);
    expect(challengeHeaders.get("Authorization")).toBeNull();
    expect(JSON.parse(String(challengeInit?.body))).toEqual({ operation: "generate", installId: "11111111-1111-4111-8111-111111111111", sceneHash: "a".repeat(64) });
  });

  it("retains the trial token when Google sign-in creates an account session", async () => {
    const clearTrialToken = vi.fn().mockResolvedValue(undefined);
    const responseBody = {
      authenticated: true,
      email: "sam@example.com",
      accessToken: "a".repeat(43),
      expiresAt: Date.now() + 60_000,
    };
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response(responseBody)),
      setAccessToken: vi.fn().mockResolvedValue(undefined),
      clearTrialToken,
    });

    await client.signInWithGoogle("google-id-token");

    expect(clearTrialToken).not.toHaveBeenCalled();
  });

  it("uses the retained trial identity when a signed-in account has free uses and no paid balance", async () => {
    const trialToken = "trial-token-123456789012345";
    const png = new Uint8Array([137, 80, 78, 71]).buffer;
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ authenticated: true, email: "sam@example.com", balance: 0, freeRemaining: null }))
      .mockResolvedValueOnce(response({ authenticated: false, email: null, balance: 0, freeRemaining: 1 }))
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(response({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }))
      .mockResolvedValueOnce(new Response(png, { status: 200, headers: { "Content-Type": "image/png", "X-Doodle-Free-Remaining": "0" } }));
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      stagePng: vi.fn().mockResolvedValue("file:///cache/doodle.png"),
      getAccessToken: async () => "a".repeat(43),
      getTrialToken: async () => trialToken,
      getInstallId: async () => "11111111-1111-4111-8111-111111111111",
      hashScene: vi.fn().mockResolvedValue("a".repeat(64)),
      requestIntegrity: vi.fn().mockResolvedValue("integrity-token-123"),
    });

    await client.getAccount();
    await client.getTrialAccount();
    await client.generate("A free scene");

    const [, challengeInit] = fetchImpl.mock.calls[3] ?? [];
    const [, generateInit] = fetchImpl.mock.calls[4] ?? [];
    const challengeHeaders = new Headers(challengeInit?.headers);
    const generateHeaders = new Headers(generateInit?.headers);
    expect(challengeHeaders.get("X-Doodle-Trial-Token")).toBe(trialToken);
    expect(challengeHeaders.get("Authorization")).toBeNull();
    expect(generateHeaders.get("X-Doodle-Trial-Token")).toBe(trialToken);
    expect(generateHeaders.get("Authorization")).toBeNull();
  });

  it("surfaces stable server errors without exposing response bodies", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ secret: "should not leak" }, { status: 402 }));
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl });

    await expect(client.getAccount()).rejects.toMatchObject({ code: "payment_required", status: 402 });
    await expect(client.getAccount()).rejects.not.toThrow("should not leak");
  });

  it("turns a hanging request into the stable timeout error", async () => {
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, requestTimeoutMs: 10 });

    await expect(client.getAccount()).rejects.toMatchObject({ code: "timeout" });
  });

  it("uses the longer operation budget for generation requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
        if (String(input).endsWith("/api/native/config")) {
          return Promise.resolve(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }));
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
    });
    const client = new NativeApiClient({
        baseUrl: "https://doodle.samistudio.nl",
        fetchImpl,
        requestTimeoutMs: 10,
        generationTimeoutMs: 100,
        stagePng: vi.fn().mockResolvedValue("file:///cache/doodle.png"),
        getAccessToken: async () => "a".repeat(43),
        getTrialToken: async () => null,
        getInstallId: async () => "11111111-1111-4111-8111-111111111111",
        createChallenge: vi.fn().mockResolvedValue({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }),
        requestIntegrity: vi.fn().mockResolvedValue("integrity-token-123"),
        hashScene: vi.fn().mockResolvedValue("a".repeat(64)),
    });
    let error: unknown;
    const pending = client.generate("A scene").catch((value) => { error = value; });
    for (let attempt = 0; attempt < 20 && fetchImpl.mock.calls.length < 2; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(error).toBeUndefined();
    await pending;
    expect(error).toMatchObject({ code: "timeout" });
  });
});
