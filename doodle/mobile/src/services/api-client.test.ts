import { describe, expect, it, vi } from "vitest";
import { NativeApiClient } from "./api-client";
import { NativeMediaService } from "./media";

function response(body: unknown, init?: ResponseInit) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("NativeApiClient", () => {
  it.each([[422, "refused"], [400, "invalid_photo"], [413, "request_too_large"]] as const)("preserves photo failure %s for the correct recovery message", async (status, code) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(response({ error: code }, { status }));
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, getAccessToken: async () => "a".repeat(43), getTrialToken: async () => null, getInstallId: async () => "11111111-1111-4111-8111-111111111111", hashScene: async () => "a".repeat(64), createChallenge: async () => ({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }), requestIntegrity: async () => "integrity-token-123" });
    await expect(client.generate("Private text", "medium", "AQID")).rejects.toMatchObject({ code, status });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
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

  it("sends only photo bytes and detail, binding the photo domain to integrity", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png", "X-Doodle-Paid-Remaining": "8" } }));
    const hashScene = vi.fn().mockResolvedValue("a".repeat(64));
    const createChallenge = vi.fn().mockResolvedValue({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 });
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, getAccessToken: async () => "a".repeat(43), getTrialToken: async () => null, getInstallId: async () => "11111111-1111-4111-8111-111111111111", hashScene, createChallenge, requestIntegrity: async () => "integrity-token-123", stagePng: async () => "file:///doodle.png" });
    await client.generate("Private text draft", "medium", "AQID");
    expect(hashScene).toHaveBeenCalledWith("doodle-photo-v1:AQID");
    expect(createChallenge).toHaveBeenCalledWith(expect.objectContaining({ sceneHash: "a".repeat(64), detailLevel: "medium" }));
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({ photo: "AQID", detailLevel: "medium" });
  });

  it("records a bounded image download failure with the generation request reference", async () => {
    const png = new Uint8Array([137, 80, 78, 71]).buffer;
    const bodyError = new Error("response body failed");
    const binary = new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
    Object.defineProperty(binary, "arrayBuffer", { configurable: true, value: vi.fn().mockRejectedValue(bodyError) });
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(binary);
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const requestId = "00000000-0000-4000-8000-000000000010";
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      diagnostics,
      requestId: () => requestId,
      stagePng: vi.fn().mockResolvedValue("file:///cache/doodle.png"),
      getAccessToken: async () => "a".repeat(43),
      getTrialToken: async () => null,
      getInstallId: async () => "11111111-1111-4111-8111-111111111111",
      createChallenge: vi.fn().mockResolvedValue({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }),
      requestIntegrity: vi.fn().mockResolvedValue("integrity-token-123"),
    });

    await expect(client.generate("A scene")).rejects.toBe(bodyError);
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      operation: "generation",
      stage: "image_download",
      code: "network",
      status: 200,
      requestId,
    }));
  });

  it("records a staged image failure with the generation request reference and rethrows it", async () => {
    const png = new Uint8Array([137, 80, 78, 71]).buffer;
    const stageError = new Error("image staging failed");
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(new Response(png, { status: 200, headers: { "Content-Type": "image/png" } }));
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const requestId = "00000000-0000-4000-8000-000000000011";
    const media = new NativeMediaService({
      fileFactory: vi.fn(() => ({ uri: "file:///cache/doodle.png", write: vi.fn().mockRejectedValue(stageError) })),
      randomId: () => "id",
      requestPermission: vi.fn().mockResolvedValue({ granted: true }),
      saveAsset: vi.fn(),
      sharingAvailable: vi.fn().mockResolvedValue(true),
      shareFile: vi.fn(),
      diagnostics,
    });
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      diagnostics,
      requestId: () => requestId,
      stagePng: (bytes) => media.stagePng(bytes),
      getAccessToken: async () => "a".repeat(43),
      getTrialToken: async () => null,
      getInstallId: async () => "11111111-1111-4111-8111-111111111111",
      createChallenge: vi.fn().mockResolvedValue({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }),
      requestIntegrity: vi.fn().mockResolvedValue("integrity-token-123"),
    });

    await expect(client.generate("A scene")).rejects.toMatchObject({ code: "media_unavailable" });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      operation: "generation",
      stage: "image_stage",
      code: "media_unavailable",
      status: 200,
      requestId,
    }));
    expect(diagnostics.record).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled JSON response body and keeps its request reference", async () => {
    vi.useFakeTimers();
    try {
      const account = new Response(null, { status: 200 });
      Object.defineProperty(account, "json", { configurable: true, value: () => new Promise<never>(() => undefined) });
      const diagnostics = { record: vi.fn(), flush: vi.fn() };
      const requestId = "00000000-0000-4000-8000-000000000012";
      const client = new NativeApiClient({
        baseUrl: "https://doodle.samistudio.nl",
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(account),
        diagnostics,
        requestId: () => requestId,
      });
      const pending = client.getAccount();
      const expectation = expect(pending).rejects.toMatchObject({ code: "timeout" });
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30_000);
      await expectation;
      expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "http_response", code: "timeout", status: 200, requestId }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves a non-2xx body timeout instead of mapping it to the HTTP status", async () => {
    vi.useFakeTimers();
    try {
      const errorResponse = new Response(null, { status: 503 });
      Object.defineProperty(errorResponse, "json", { configurable: true, value: () => new Promise<never>(() => undefined) });
      const diagnostics = { record: vi.fn(), flush: vi.fn() };
      const requestId = "00000000-0000-4000-8000-000000000016";
      const client = new NativeApiClient({
        baseUrl: "https://doodle.samistudio.nl",
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(errorResponse),
        diagnostics,
        requestTimeoutMs: 30_000,
        requestId: () => requestId,
      });
      const pending = client.getAccount();
      const expectation = expect(pending).rejects.toMatchObject({ code: "timeout" });
      for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30_000);
      await expectation;
      expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "http_response", code: "timeout", status: 503, requestId }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("records malformed successful account and config responses without body content", async () => {
    const accountDiagnostics = { record: vi.fn(), flush: vi.fn() };
    const accountClient = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({ unexpected: "private" })),
      diagnostics: accountDiagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000013",
    });
    await expect(accountClient.getAccount()).rejects.toMatchObject({ code: "network", status: 200 });
    expect(accountDiagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "account_read", code: "network", status: 200, requestId: "00000000-0000-4000-8000-000000000013" }));
    expect(JSON.stringify(accountDiagnostics.record.mock.calls)).not.toContain("private");

    const configDiagnostics = { record: vi.fn(), flush: vi.fn() };
    const configClient = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({ unexpected: "private" })),
      diagnostics: configDiagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000014",
    });
    await expect(configClient.getConfig()).rejects.toMatchObject({ code: "network", status: 200 });
    expect(configDiagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "startup", stage: "config_fetch", code: "network", status: 200, requestId: "00000000-0000-4000-8000-000000000014" }));
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

  it("records a token persistence failure once with the sign-in request reference", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const requestId = "00000000-0000-4000-8000-000000000018";
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({
        authenticated: true,
        email: "sam@example.com",
        accessToken: "a".repeat(43),
        expiresAt: Date.now() + 60_000,
      })),
      setAccessToken: vi.fn().mockRejectedValue(new Error("secure store details")),
      diagnostics,
      requestId: () => requestId,
    });

    await expect(client.signInWithGoogle("google-id-token")).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(diagnostics.record).toHaveBeenCalledTimes(1);
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "auth", stage: "google_token", code: "auth_unavailable", status: 200, requestId }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("secure store details");
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
  it.each([4, 5])("accepts a server guest allowance of %s without an app quota cap", async (freeRemaining) => {
    const token = "11111111-1111-4111-8111-111111111111." + "s".repeat(43);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(response({ trialToken: token, expiresAt: Date.now() + 60000, freeRemaining }));
    let saved: string | null = null;
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl,
      getAccessToken: async () => null, getTrialToken: async () => saved,
      setTrialToken: async (value) => { saved = value; },
      createChallenge: async () => ({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 60000 }),
      requestIntegrity: async () => "integrity-token-123" });
    await expect(client.createGuestSession("11111111-1111-4111-8111-111111111111")).resolves.toMatchObject({ freeRemaining });
    expect(saved).toBe(token);
    expect(new Headers(fetchImpl.mock.calls[1][1]?.headers).get("X-Doodle-Trial-Policy")).toBe("dynamic");
  });

  it("adds a request reference and records network failures without changing the stable error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("ERR_CONNECTION_REFUSED"));
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, diagnostics, requestId: () => "00000000-0000-4000-8000-000000000001" });

    await expect(client.getAccount()).rejects.toMatchObject({ code: "network" });
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("X-Doodle-Request-Id")).toBe("00000000-0000-4000-8000-000000000001");
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "account_read", code: "network", requestId: "00000000-0000-4000-8000-000000000001" }));
    expect(diagnostics.flush).not.toHaveBeenCalled();
  });

  it("records non-success HTTP status and flushes only after a successful response", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn().mockResolvedValue(false) };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ error: "native_generation_unavailable" }, { status: 503 }));
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, diagnostics, requestId: () => "00000000-0000-4000-8000-000000000002" });

    await expect(client.getAccount()).rejects.toMatchObject({ code: "native_generation_unavailable", status: 503 });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "http_response", code: "native_generation_unavailable", status: 503, requestId: "00000000-0000-4000-8000-000000000002" }));
    expect(diagnostics.flush).not.toHaveBeenCalled();

    const success = vi.fn<typeof fetch>().mockResolvedValue(response({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }));
    const successClient = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl: success, diagnostics, requestId: () => "00000000-0000-4000-8000-000000000003" });
    await successClient.getAccount();
    expect(diagnostics.flush).toHaveBeenCalledTimes(1);
  });

  it.each(["refused", "timeout", "temporary_error", "invalid_credential", "play_unavailable"])("keeps portable server error %s in diagnostics while preserving the UI error", async (serverCode) => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ error: serverCode }, { status: 503 }));
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      diagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000015",
    });

    await expect(client.getAccount()).rejects.toMatchObject({ code: "network", status: 503 });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "http_response", code: serverCode, status: 503 }));
  });

  it("records secure-session read failures without calling the network", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const client = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl,
      getAccessToken: vi.fn().mockRejectedValue(new Error("secure store details")),
      diagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000004",
    });

    await expect(client.getAccount()).rejects.toMatchObject({ code: "network" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "account", stage: "session_read", code: "network" }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("secure store details");
  });


  it.each(["medium", "detailed"] as const)("sends the same %s level for the challenge and image request", async (detailLevel) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ enabled: true, packageName: "nl.samistudio.doodle", minimumVersionCode: 2, attestation: "play_integrity", guestEnabled: true, cloudProjectNumber: "123" }))
      .mockResolvedValueOnce(response({ challenge: "c".repeat(43), requestHash: "h".repeat(43), expiresAt: Date.now() + 1000 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([137,80,78,71]), { headers: { "Content-Type": "image/png" } }));
    const requestIntegrity = vi.fn().mockResolvedValue("integrity-token-123");
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, requestIntegrity, getInstallId: async () => "11111111-1111-4111-8111-111111111111", getAccessToken: async () => "a".repeat(43), hashScene: async () => "b".repeat(64), stagePng: async () => "file:///doodle.png" });
    await client.generate(" Two cats hug ", detailLevel);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({ operation: "generate", installId: "11111111-1111-4111-8111-111111111111", sceneHash: "b".repeat(64), detailLevel });
    expect(JSON.parse(String(fetchImpl.mock.calls[2][1]?.body))).toEqual({ scene: "Two cats hug", detailLevel });
    expect(requestIntegrity).toHaveBeenCalledWith("h".repeat(43));
  });
  it("rejects an invalid level before reading a session or making requests", async () => {
    const fetchImpl = vi.fn(), getAccessToken = vi.fn();
    const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, getAccessToken });
    await expect(client.generate("A cat", "hard" as never)).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

});
