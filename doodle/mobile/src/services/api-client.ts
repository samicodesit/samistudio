import { isDetailLevel, type DetailLevel } from "../../../src/lib/generation/detail-level";
import { isPhotoPayload, photoAttestationInput } from "../../../src/lib/generation/photo-input";
import {
  isNativeConfig,
  MAX_SCENE_LENGTH,
  NATIVE_CLIENT,
  NATIVE_MINIMUM_VERSION_CODE,
  NATIVE_ORIGIN,
  NATIVE_PACKAGE_NAME,
  NATIVE_PRODUCT_ID,
  type AccountSummary,
  type NativeApi,
  type NativeChallengeResponse,
  type NativeConfigResponse,
  type NativeGenerationResult,
  type NativeGoogleResponse,
  type NativeGuestSessionResponse,
  type NativePlayConfig,
  type NativePlayVerifyResponse,
} from "../contracts/native";
import { diagnosticCode, DIAGNOSTIC_UUID, type DiagnosticOperation, type DiagnosticStage } from "../../../src/lib/diagnostics/events";
import type { NativeDiagnosticInput, NativeDiagnosticsSink } from "./diagnostics";
import { NativeServiceError, type NativeServiceErrorCode } from "./errors";

type FetchLike = typeof fetch;

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_GENERATION_TIMEOUT_MS = 185_000;
const MAX_REQUEST_TIMEOUT_MS = 190_000;

export interface NativeApiClientOptions {
  baseUrl: string;
  platform?: "android" | "ios";
  requestTimeoutMs?: number;
  generationTimeoutMs?: number;
  fetchImpl?: FetchLike;
  getAccessToken?: () => Promise<string | null>;
  setAccessToken?: (response: Pick<NativeGoogleResponse, "accessToken" | "expiresAt">) => Promise<void>;
  clearAccessToken?: () => Promise<void>;
  getTrialToken?: () => Promise<string | null>;
  setTrialToken?: (token: string) => Promise<void>;
  clearTrialToken?: () => Promise<void>;
  getInstallId?: () => Promise<string>;
  stagePng?: (bytes: ArrayBuffer) => Promise<string>;
  createChallenge?: (input: { operation: "guest" | "generate"; installId: string; sceneHash?: string; detailLevel?: DetailLevel }) => Promise<NativeChallengeResponse>;
  requestIntegrity?: (requestHash: string) => Promise<string>;
  hashScene?: (scene: string) => Promise<string>;
  submitReport?: (payload: { locale: string; report: { reason: string; details: string; includeContent: boolean }; scene?: string; imageBase64?: string }) => Promise<{ id: string }>;
  diagnostics?: NativeDiagnosticsSink;
  requestId?: () => string;
}

type AuthMode = "auto" | "access" | "trial" | "none";
type RequestOptions = RequestInit & {
  includeTrial?: boolean;
  auth?: AuthMode;
  timeoutMs?: number;
  diagnosticOperation?: DiagnosticOperation;
  diagnosticStage?: DiagnosticStage;
};

type RequestMetadata = {
  operation: DiagnosticOperation;
  requestId?: string;
  durationMs: number;
  startedAt: number;
  deadlineAt: number;
  controller?: AbortController;
  callerSignal?: AbortSignal;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TRIAL_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,4096}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const INTEGRITY_TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{16,16384}$/;

const ERROR_CODES = new Set<NativeServiceErrorCode>([
  "invalid_request",
  "unauthorized",
  "forbidden",
  "native_generation_unavailable",
  "native_attestation_required",
  "native_attestation_failed",
  "payment_required",
  "rate_limited",
  "not_found",
  "report_unavailable",
  "auth_unavailable",
]);

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(trimmed) && !/^http:\/\//i.test(trimmed)) {
    throw new NativeServiceError("network", "Invalid native API base URL");
  }
  return trimmed;
}

function normalizeScene(scene: string): string {
  if (typeof scene !== "string" || scene.trim().length === 0) {
    throw new NativeServiceError("invalid_request");
  }
  const normalized = scene.trim();
  if (Array.from(normalized).length > MAX_SCENE_LENGTH) {
    throw new NativeServiceError("invalid_request");
  }
  return normalized;
}

function mapErrorCode(status: number, value: unknown): NativeServiceErrorCode {
  if (value && typeof value === "object" && typeof (value as { error?: unknown }).error === "string") {
    const code = (value as { error: string }).error as NativeServiceErrorCode;
    if (ERROR_CODES.has(code)) return code;
  }
  if (status === 401) return "unauthorized";
  if (status === 402) return "payment_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return status >= 500 ? "network" : "unknown";
}

function parseFiniteHeader(response: Response, name: string): number | undefined {
  const raw = response.headers.get(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isValidAccessToken(value: unknown): value is string {
  return typeof value === "string" && ACCESS_TOKEN_PATTERN.test(value);
}

function isValidTrialToken(value: unknown): value is string {
  return typeof value === "string" && TRIAL_TOKEN_PATTERN.test(value);
}

function validAccountSummary(value: unknown): value is AccountSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<AccountSummary>;
  const balance = summary.balance;
  const freeRemaining = summary.freeRemaining;
  return (
    typeof summary.authenticated === "boolean" &&
    (summary.email === null || typeof summary.email === "string") &&
    Number.isSafeInteger(balance) &&
    (balance as number) >= 0 &&
    (freeRemaining === null || (Number.isSafeInteger(freeRemaining) && (freeRemaining as number) >= 0))
  );
}

function validNativeGoogleResponse(value: unknown): value is NativeGoogleResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<NativeGoogleResponse>;
  const expiresAt = response.expiresAt;
  return (
    response.authenticated === true &&
    typeof response.email === "string" &&
    response.email.length <= 254 &&
    ACCESS_TOKEN_PATTERN.test(response.accessToken ?? "") &&
    Number.isSafeInteger(expiresAt) &&
    (expiresAt as number) > Date.now()
  );
}

function validNativeChallenge(value: unknown): value is NativeChallengeResponse {
  if (!value || typeof value !== "object") return false;
  const challenge = value as Partial<NativeChallengeResponse>;
  const expiresAt = challenge.expiresAt;
  return (
    typeof challenge.challenge === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(challenge.challenge) &&
    typeof challenge.requestHash === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(challenge.requestHash) &&
    Number.isSafeInteger(expiresAt) &&
    (expiresAt as number) > Date.now()
  );
}

function validNativeGuestResponse(value: unknown): value is NativeGuestSessionResponse {
  if (!value || typeof value !== "object") return false;
  const guest = value as Partial<NativeGuestSessionResponse>;
  return (
    isValidTrialToken(guest.trialToken) &&
    typeof guest.expiresAt === "number" &&
    Number.isSafeInteger(guest.expiresAt) &&
    guest.expiresAt > Date.now() &&
    typeof guest.freeRemaining === "number" &&
    Number.isSafeInteger(guest.freeRemaining) &&
    guest.freeRemaining >= 0
  );
}

function validNativeConfig(value: unknown): value is NativeConfigResponse {
  return isNativeConfig(value) && value.packageName === NATIVE_PACKAGE_NAME && value.minimumVersionCode >= NATIVE_MINIMUM_VERSION_CODE;
}

export class NativeApiClient implements NativeApi {
  private readonly baseUrl: string;
  private readonly platform: "android" | "ios";
  private readonly requestTimeoutMs: number;
  private readonly generationTimeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly setAccessToken: (response: Pick<NativeGoogleResponse, "accessToken" | "expiresAt">) => Promise<void>;
  private readonly clearAccessToken: () => Promise<void>;
  private readonly getTrialToken: () => Promise<string | null>;
  private readonly setTrialToken: (token: string) => Promise<void>;
  private readonly clearTrialToken: () => Promise<void>;
  private readonly getInstallId: () => Promise<string>;
  private readonly stagePng: (bytes: ArrayBuffer) => Promise<string>;
  private readonly createChallengeOverride?: NativeApiClientOptions["createChallenge"];
  private readonly requestIntegrity?: NativeApiClientOptions["requestIntegrity"];
  private readonly hashScene: (scene: string) => Promise<string>;
  private readonly submitReportOverride?: NativeApiClientOptions["submitReport"];
  private readonly diagnostics?: NativeDiagnosticsSink;
  private readonly requestId: () => string;
  private readonly requestMetadata = new WeakMap<Response, RequestMetadata>();
  private paidBalance: number | null = null;
  private trialFreeRemaining: number | null = null;

  constructor(options: NativeApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.platform = options.platform ?? "android";
    this.requestTimeoutMs = boundedTimeout(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
    this.generationTimeoutMs = boundedTimeout(options.generationTimeoutMs, DEFAULT_GENERATION_TIMEOUT_MS);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.getAccessToken = options.getAccessToken ?? (async () => null);
    this.setAccessToken = options.setAccessToken ?? (async () => undefined);
    this.clearAccessToken = options.clearAccessToken ?? (async () => undefined);
    this.getTrialToken = options.getTrialToken ?? (async () => null);
    this.setTrialToken = options.setTrialToken ?? (async () => undefined);
    this.clearTrialToken = options.clearTrialToken ?? (async () => undefined);
    this.getInstallId = options.getInstallId ?? (async () => {
      throw new NativeServiceError("native_generation_unavailable");
    });
    this.stagePng = options.stagePng ?? (async () => {
      throw new NativeServiceError("media_unavailable");
    });
    this.createChallengeOverride = options.createChallenge;
    this.requestIntegrity = options.requestIntegrity;
    this.hashScene = options.hashScene ?? sha256Hex;
    this.submitReportOverride = options.submitReport;
    this.diagnostics = options.diagnostics;
    this.requestId = options.requestId ?? (() => globalThis.crypto?.randomUUID?.() ?? "");
  }

  private async headers(includeTrial: boolean, auth: AuthMode): Promise<Headers> {
    const headers = new Headers({
      Accept: "application/json",
      Origin: NATIVE_ORIGIN,
      "X-Doodle-Client": NATIVE_CLIENT,
    });
    if (auth === "none") return headers;
    const accessToken = auth === "trial" ? null : await this.getAccessToken();
    if (accessToken && ACCESS_TOKEN_PATTERN.test(accessToken)) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else if (includeTrial || auth === "trial") {
      const trialToken = await this.getTrialToken();
      if (trialToken && TRIAL_TOKEN_PATTERN.test(trialToken)) headers.set("X-Doodle-Trial-Token", trialToken);
    }
    return headers;
  }

  private async request(path: string, options: RequestOptions = {}): Promise<Response> {
    const operation = options.diagnosticOperation ?? diagnosticOperationForPath(path);
    const stage = options.diagnosticStage ?? "http_request";
    const requestReference = validRequestId(this.requestId());
    const startedAt = Date.now();
    let headers: Headers;
    try {
      headers = await this.headers(options.includeTrial ?? false, options.auth ?? "auto");
    } catch {
      this.safeRecord({ operation, stage: "session_read", code: "network", requestId: requestReference, durationMs: boundedDuration(Date.now() - startedAt) });
      throw new NativeServiceError("network");
    }
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    }
    if (requestReference) headers.set("X-Doodle-Request-Id", requestReference);
    headers.delete("includeTrial");
    const { includeTrial: _includeTrial, auth: _auth, timeoutMs: requestedTimeout, diagnosticOperation: _diagnosticOperation, diagnosticStage: _diagnosticStage, ...init } = options;
    void _includeTrial;
    void _auth;
    init.headers = headers;
    init.credentials = "omit";
    const timeoutMs = boundedTimeout(requestedTimeout, this.requestTimeoutMs);
    const callerSignal = init.signal;
    const controller = typeof AbortController === "function" ? new AbortController() : undefined;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onCallerAbort = () => controller?.abort();
    if (callerSignal?.aborted) {
      this.safeRecord({ operation, stage, code: "network", requestId: requestReference, durationMs: boundedDuration(Date.now() - startedAt) });
      throw new NativeServiceError("network");
    }
    if (callerSignal && controller) {
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
    if (controller) init.signal = controller.signal;
    try {
      const response = this.fetchImpl(`${this.baseUrl}${path}`, init);
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller?.abort();
          reject(new NativeServiceError("timeout"));
        }, timeoutMs);
      });
      const resolved = await Promise.race([response, timeout]);
      this.requestMetadata.set(resolved, {
        operation,
        requestId: requestReference,
        durationMs: boundedDuration(Date.now() - startedAt),
        startedAt,
        deadlineAt: startedAt + timeoutMs,
        controller,
        callerSignal: callerSignal ?? undefined,
      });
      if (resolved.ok) this.safeFlush();
      return resolved;
    } catch {
      const code = timedOut ? "timeout" : "network";
      this.safeRecord({ operation, stage, code, requestId: requestReference, durationMs: boundedDuration(Date.now() - startedAt) });
      if (timedOut) throw new NativeServiceError("timeout");
      throw new NativeServiceError("network");
    } finally {
      if (timer) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await this.readResponseBody(response, () => response.json());
    } catch (error) {
      const code = error instanceof NativeServiceError && (error.code === "timeout" || error.code === "network")
        ? error.code
        : "network";
      this.recordResponseDiagnostic(response, "startup", "http_response", code);
      if (error instanceof NativeServiceError && error.code === "timeout") throw error;
      throw new NativeServiceError("network", "Invalid server response", response.status);
    }
  }

  private async requireOk(response: Response): Promise<unknown> {
    if (response.ok) return this.readJson(response);
    let body: unknown;
    let bodyReadError: unknown;
    try {
      body = await this.readResponseBody(response, () => response.json());
    } catch (error) {
      bodyReadError = error;
      body = undefined;
    }
    if (bodyReadError instanceof NativeServiceError && bodyReadError.code === "timeout") {
      this.recordResponseDiagnostic(response, "startup", "http_response", "timeout");
      throw bodyReadError;
    }
    const code = mapErrorCode(response.status, body);
    const bodyError = body && typeof body === "object" && !Array.isArray(body)
      ? (body as { error?: unknown }).error
      : undefined;
    this.recordResponseDiagnostic(response, "startup", "http_response", bodyError === undefined ? code : diagnosticCode(bodyError));
    throw new NativeServiceError(code, code, response.status);
  }

  private async readResponseBody<T>(response: Response, reader: () => Promise<T>): Promise<T> {
    const metadata = this.requestMetadata.get(response);
    const remaining = metadata ? Math.max(0, metadata.deadlineAt - Date.now()) : undefined;
    if (remaining === 0) {
      metadata?.controller?.abort();
      throw new NativeServiceError("timeout");
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const callerSignal = metadata?.callerSignal;
    const onCallerAbort = () => metadata?.controller?.abort();
    if (callerSignal?.aborted) throw new NativeServiceError("network");
    if (callerSignal && metadata?.controller) callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    try {
      const body = reader();
      if (remaining === undefined) return await body;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          metadata?.controller?.abort();
          reject(new NativeServiceError("timeout"));
        }, remaining);
      });
      return await Promise.race([body, timeout]);
    } catch (error) {
      if (timedOut) throw new NativeServiceError("timeout");
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private recordResponseDiagnostic(response: Response, fallbackOperation: DiagnosticOperation, stage: DiagnosticStage, code: unknown): void {
    const metadata = this.requestMetadata.get(response);
    const input: NativeDiagnosticInput = {
      operation: metadata?.operation ?? fallbackOperation,
      stage,
      code,
      status: response.status,
    };
    if (metadata?.requestId) input.requestId = metadata.requestId;
    if (metadata) input.durationMs = boundedDuration(Date.now() - metadata.startedAt);
    this.safeRecord(input);
  }

  private safeRecordMalformedResponse(response: Response | undefined, fallbackOperation: DiagnosticOperation, stage: DiagnosticStage, code: unknown = "network"): void {
    if (response) {
      this.recordResponseDiagnostic(response, fallbackOperation, stage, code);
      return;
    }
    this.safeRecord({ operation: fallbackOperation, stage, code });
  }

  private safeRecord(input: NativeDiagnosticInput): void {
    try {
      void Promise.resolve(this.diagnostics?.record(input)).catch(() => undefined);
    } catch {
      // Diagnostics must never alter a service result.
    }
  }

  private safeFlush(): void {
    try {
      void Promise.resolve(this.diagnostics?.flush()).catch(() => undefined);
    } catch {
      // Diagnostics upload is best effort.
    }
  }

  async getConfig(): Promise<NativeConfigResponse> {
    const response = await this.request("/api/native/config", { diagnosticStage: "config_fetch" });
    const body = await this.requireOk(response);
    if (!validNativeConfig(body)) {
      this.safeRecordMalformedResponse(response, "startup", "config_fetch");
      throw new NativeServiceError("network", "Invalid native configuration", response.status);
    }
    return body;
  }

  async signInWithGoogle(credential: string): Promise<NativeGoogleResponse> {
    if (typeof credential !== "string" || credential.length === 0 || credential.length > 8192) {
      throw new NativeServiceError("invalid_request");
    }
    const response = await this.request("/api/native/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
      diagnosticStage: "google_token",
    });
    const body = await this.requireOk(response);
    if (!validNativeGoogleResponse(body)) {
      this.safeRecordMalformedResponse(response, "auth", "google_token");
      throw new NativeServiceError("network", "Invalid sign-in response", response.status);
    }
    try {
      await this.setAccessToken(body);
    } catch {
      this.recordResponseDiagnostic(response, "auth", "google_token", "auth_unavailable");
      throw new NativeServiceError("auth_unavailable");
    }
    this.paidBalance = null;
    return body;
  }

  async signOut(): Promise<void> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      await this.clearAccessToken();
      this.paidBalance = null;
      return;
    }
    try {
      const response = await this.request("/api/native/auth/sign-out", { method: "POST", diagnosticOperation: "auth", diagnosticStage: "session_create" });
      if (!response.ok) await this.requireOk(response);
    } finally {
      await this.clearAccessToken();
      this.paidBalance = null;
    }
  }

  async getAccount(): Promise<AccountSummary> {
    let accessToken: string | null;
    let trialToken: string | null;
    try {
      accessToken = await this.getAccessToken();
      trialToken = await this.getTrialToken();
    } catch {
      this.safeRecord({ operation: "account", stage: "session_read", code: "network" });
      throw new NativeServiceError("network");
    }
    const response = await this.request("/api/account", { includeTrial: true, diagnosticStage: "account_read" });
    const body = await this.requireOk(response);
    if (!validAccountSummary(body)) {
      this.safeRecordMalformedResponse(response, "account", "account_read");
      throw new NativeServiceError("network", "Invalid account response", response.status);
    }
    if (isValidAccessToken(accessToken)) {
      this.paidBalance = body.authenticated ? body.balance : null;
    } else if (isValidTrialToken(trialToken)) {
      this.trialFreeRemaining = body.freeRemaining;
    }
    return body;
  }

  async getTrialAccount(): Promise<AccountSummary> {
    let trialToken: string | null;
    try {
      trialToken = await this.getTrialToken();
    } catch {
      this.safeRecord({ operation: "account", stage: "session_read", code: "network" });
      throw new NativeServiceError("network");
    }
    if (!isValidTrialToken(trialToken)) throw new NativeServiceError("unauthorized");
    const response = await this.request("/api/account", { includeTrial: true, auth: "trial", diagnosticStage: "account_read" });
    const body = await this.requireOk(response);
    if (!validAccountSummary(body) || body.authenticated) {
      this.safeRecordMalformedResponse(response, "account", "account_read");
      throw new NativeServiceError("network", "Invalid guest account response", response.status);
    }
    this.trialFreeRemaining = body.freeRemaining;
    return body;
  }

  async deleteAccount(): Promise<void> {
    const response = await this.request("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
      includeTrial: true,
      diagnosticStage: "account_read",
    });
    if (!response.ok) await this.requireOk(response);
    await this.clearAccessToken();
    await this.clearTrialToken();
    this.paidBalance = null;
    this.trialFreeRemaining = null;
  }

  private async requestChallenge(input: { operation: "guest" | "generate"; installId: string; sceneHash?: string; detailLevel?: DetailLevel }, auth: AuthMode = "none"): Promise<NativeChallengeResponse> {
    if (!UUID_PATTERN.test(input.installId)) throw new NativeServiceError("invalid_request");
    if (input.operation === "generate" && !HASH_PATTERN.test(input.sceneHash ?? "")) throw new NativeServiceError("invalid_request");
    if (this.createChallengeOverride) {
      const challenge = await this.createChallengeOverride(input);
      if (!validNativeChallenge(challenge)) {
        this.safeRecordMalformedResponse(undefined, "integrity", "attestation_challenge");
        throw new NativeServiceError("network", "Invalid attestation challenge");
      }
      return challenge;
    }
    const body = input.operation === "guest"
      ? { operation: input.operation, installId: input.installId }
      : { operation: input.operation, installId: input.installId, sceneHash: input.sceneHash, ...(input.detailLevel && input.detailLevel !== "simple" ? { detailLevel: input.detailLevel } : {}) };
    const response = await this.request("/api/native/attestation/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      includeTrial: auth === "trial",
      auth,
      diagnosticStage: "attestation_challenge",
    });
    const value = await this.requireOk(response);
    if (!validNativeChallenge(value)) {
      this.safeRecordMalformedResponse(response, "integrity", "attestation_challenge");
      throw new NativeServiceError("network", "Invalid attestation challenge", response.status);
    }
    return value;
  }

  async createGuestSession(installId: string): Promise<NativeGuestSessionResponse> {
    if (this.platform !== "android") throw new NativeServiceError("native_generation_unavailable");
    const config = await this.getConfig();
    if (!config.enabled || !config.guestEnabled || !config.cloudProjectNumber) {
      throw new NativeServiceError("native_generation_unavailable");
    }
    const challenge = await this.requestChallenge({ operation: "guest", installId });
    if (!this.requestIntegrity) throw new NativeServiceError("native_generation_unavailable");
    const integrityToken = await this.requestIntegrity(challenge.requestHash);
    if (!INTEGRITY_TOKEN_PATTERN.test(integrityToken)) {
      this.safeRecord({ operation: "integrity", stage: "attestation_verify", code: "native_attestation_required" });
      throw new NativeServiceError("native_attestation_required");
    }
    const response = await this.request("/api/native/session/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Doodle-Trial-Policy": "dynamic" },
      body: JSON.stringify({ installId, challenge: challenge.challenge, integrityToken }),
      diagnosticStage: "session_create",
    });
    const body = await this.requireOk(response);
    if (!validNativeGuestResponse(body)) {
      this.safeRecordMalformedResponse(response, "guest", "session_create");
      throw new NativeServiceError("network", "Invalid guest session response", response.status);
    }
    await this.setTrialToken(body.trialToken);
    this.trialFreeRemaining = body.freeRemaining;
    return body;
  }

  async generate(scene: string, detailLevel: DetailLevel = "simple", photo?: string): Promise<NativeGenerationResult> {
    if (this.platform !== "android") throw new NativeServiceError("native_generation_unavailable");
    if (!isDetailLevel(detailLevel)) throw new NativeServiceError("invalid_request");
    if (photo !== undefined && !isPhotoPayload(photo)) throw new NativeServiceError("invalid_request");
    const normalizedScene = photo === undefined ? normalizeScene(scene) : photoAttestationInput(photo);
    const installId = await this.getInstallId();
    const accessToken = await this.getAccessToken();
    const config = await this.getConfig();
    if (!config.enabled || !config.cloudProjectNumber) throw new NativeServiceError("native_generation_unavailable");

    let auth: AuthMode = isValidAccessToken(accessToken) ? "access" : "trial";
    let trialToken = await this.getTrialToken();
    if (!isValidAccessToken(accessToken)) {
      if (!trialToken) await this.createGuestSession(installId);
      trialToken = await this.getTrialToken();
    } else if (isValidTrialToken(trialToken) && this.paidBalance === 0) {
      if (this.trialFreeRemaining === null) {
        try {
          await this.getTrialAccount();
        } catch {
          // Fall back to the authenticated account when the retained trial session cannot be read.
        }
      }
      if (this.trialFreeRemaining !== null && this.trialFreeRemaining > 0) auth = "trial";
    }
    if (auth === "trial" && !isValidTrialToken(trialToken)) throw new NativeServiceError("native_generation_unavailable");

    const sceneHash = await this.hashScene(normalizedScene);
    const challenge = await this.requestChallenge({ operation: "generate", installId, sceneHash, ...(detailLevel !== "simple" ? { detailLevel } : {}) }, auth);
    if (!this.requestIntegrity) throw new NativeServiceError("native_generation_unavailable");
    const integrityToken = await this.requestIntegrity(challenge.requestHash);
    if (!INTEGRITY_TOKEN_PATTERN.test(integrityToken)) {
      this.safeRecord({ operation: "integrity", stage: "attestation_verify", code: "native_attestation_required" });
      throw new NativeServiceError("native_attestation_required");
    }
    const response = await this.request("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Doodle-Install-Id": installId,
        "X-Doodle-Attestation-Challenge": challenge.challenge,
        "X-Doodle-Attestation-Token": integrityToken,
      },
      body: JSON.stringify({ ...(photo === undefined ? { scene: normalizedScene } : { photo }), ...(detailLevel !== "simple" ? { detailLevel } : {}) }),
      includeTrial: auth === "trial",
      auth,
      timeoutMs: this.generationTimeoutMs,
      diagnosticStage: "http_request",
    });
    if (!response.ok) await this.requireOk(response);
    let imageBytes: ArrayBuffer;
    try {
      imageBytes = await this.readResponseBody(response, () => response.arrayBuffer());
    } catch (error) {
      this.recordResponseDiagnostic(response, "generation", "image_download", error instanceof NativeServiceError ? error.code : "network");
      throw error;
    }
    let imageUri: string;
    try {
      imageUri = await this.stagePng(imageBytes);
    } catch (error) {
      this.recordResponseDiagnostic(response, "generation", "image_stage", "media_unavailable");
      throw error;
    }
    const freeRemaining = parseFiniteHeader(response, "X-Doodle-Free-Remaining");
    const paidRemaining = parseFiniteHeader(response, "X-Doodle-Paid-Remaining");
    if (typeof freeRemaining === "number") this.trialFreeRemaining = freeRemaining;
    if (typeof paidRemaining === "number") this.paidBalance = paidRemaining;
    return {
      imageUri,
      freeRemaining,
      paidRemaining,
    };
  }

  async getPlayConfig(): Promise<NativePlayConfig> {
    const response = await this.request("/api/play/config", { auth: "access", diagnosticStage: "billing_prepare" });
    const body = await this.requireOk(response);
    if (!body || typeof body !== "object") {
      this.safeRecordMalformedResponse(response, "billing", "billing_prepare");
      throw new NativeServiceError("network", "Invalid Play configuration", response.status);
    }
    const config = body as Partial<NativePlayConfig>;
    if (config.enabled !== true || config.productId !== NATIVE_PRODUCT_ID || typeof config.obfuscatedAccountId !== "string" || !/^[a-f0-9]{64}$/.test(config.obfuscatedAccountId)) {
      this.safeRecordMalformedResponse(response, "billing", "billing_prepare", "billing_unavailable");
      throw new NativeServiceError("billing_unavailable");
    }
    return config as NativePlayConfig;
  }

  async verifyPlayPurchase(input: { productId: typeof NATIVE_PRODUCT_ID; purchaseToken: string }): Promise<NativePlayVerifyResponse> {
    if (input.productId !== NATIVE_PRODUCT_ID || typeof input.purchaseToken !== "string" || input.purchaseToken.length === 0 || input.purchaseToken.length > 16_384) {
      throw new NativeServiceError("invalid_request");
    }
    const response = await this.request("/api/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: input.productId, purchaseToken: input.purchaseToken }),
      auth: "access",
      diagnosticStage: "billing_verify",
    });
    const body = await this.requireOk(response);
    if (!body || typeof body !== "object") {
      this.safeRecordMalformedResponse(response, "billing", "billing_verify");
      throw new NativeServiceError("network", "Invalid Play verification response", response.status);
    }
    const value = body as Partial<NativePlayVerifyResponse>;
    if (!["granted", "already_granted", "granted_consume_pending"].includes(value.status ?? "") || !Number.isSafeInteger(value.balance) || (value.balance ?? -1) < 0) {
      this.safeRecordMalformedResponse(response, "billing", "billing_verify");
      throw new NativeServiceError("network", "Invalid Play verification response", response.status);
    }
    return value as NativePlayVerifyResponse;
  }

  async submitReport(input: { locale: string; report: { reason: string; details: string; includeContent: boolean }; scene?: string; imageBase64?: string }): Promise<{ id: string }> {
    if (this.submitReportOverride) return this.submitReportOverride(input);
    const body = input.report.includeContent
      ? { reason: input.report.reason, details: input.report.details, locale: input.locale, includeContent: true, scene: input.scene, imageBase64: input.imageBase64 }
      : { reason: input.report.reason, details: input.report.details, locale: input.locale, includeContent: false };
    const response = await this.request("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      includeTrial: true,
      diagnosticStage: "report_submit",
    });
    const value = await this.requireOk(response);
    if (!value || typeof value !== "object" || typeof (value as { id?: unknown }).id !== "string" || !(value as { id: string }).id) {
      this.safeRecordMalformedResponse(response, "report", "report_submit");
      throw new NativeServiceError("network", "Invalid report response", response.status);
    }
    return { id: (value as { id: string }).id };
  }
}

async function sha256Hex(value: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== "function") throw new NativeServiceError("native_generation_unavailable");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function boundedTimeout(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? Math.min(value ?? fallback, MAX_REQUEST_TIMEOUT_MS)
    : fallback;
}

function boundedDuration(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, MAX_REQUEST_TIMEOUT_MS) : 0;
}

function validRequestId(value: string): string | undefined {
  return DIAGNOSTIC_UUID.test(value) ? value : undefined;
}

function diagnosticOperationForPath(path: string): DiagnosticOperation {
  if (path === "/api/account") return "account";
  if (path === "/api/native/auth/google") return "auth";
  if (path === "/api/native/session/guest") return "guest";
  if (path === "/api/native/attestation/challenge") return "integrity";
  if (path === "/api/generate") return "generation";
  if (path.startsWith("/api/play/")) return "billing";
  if (path === "/api/reports") return "report";
  return "startup";
}

