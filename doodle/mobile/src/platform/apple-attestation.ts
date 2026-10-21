import * as AppIntegrity from "@expo/app-integrity";
import type { NativeSecureStorage } from "../services/session-store";
import { NativeServiceError } from "../services/errors";
import type { NativeDiagnosticsSink } from "../services/diagnostics";
export interface AppleIntegrityModule {
  isSupported: boolean;
  generateKeyAsync(): Promise<string>;
  attestKeyAsync(keyId: string, payload: string): Promise<string>;
  generateAssertionAsync(keyId: string, payload: string): Promise<string>;
}
export interface AppleProofContext { keyScope: string; challenge: string; requestHash: string; expiresAt: number }
export interface AppleRegistration { keyId: string; challenge: string; attestation: string }
export interface NativeAppleAttestation {
  prove(context: AppleProofContext, register: (input: AppleRegistration) => Promise<void>): Promise<{ registered: true } | { keyId: string; assertion: string }>;
  forget(scope: string): Promise<void>;
}
const module: AppleIntegrityModule = {
  get isSupported() { return AppIntegrity.isSupported; },
  generateKeyAsync: () => AppIntegrity.generateKeyAsync(),
  attestKeyAsync: (keyId, payload) => AppIntegrity.attestKeyAsync(keyId, payload),
  generateAssertionAsync: (keyId, payload) => AppIntegrity.generateAssertionAsync(keyId, payload),
};
interface StoredKey { keyId: string; phase: "generated" | "attested" }
const validKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9+/]{43}=$/.test(value);
export function createAppleAttestation(storage: NativeSecureStorage, integrity = module, diagnostics?: NativeDiagnosticsSink): NativeAppleAttestation {
  const registration = new Map<string, Promise<void>>();
  const pending = new Map<string, AppleRegistration & { expiresAt: number }>();
  const storageKey = (scope: string) => `doodle.apple.attest.${scope}`;
  const forget = async (scope: string) => { pending.delete(scope); await storage.deleteItem(storageKey(scope)); };
  const load = async (scope: string): Promise<StoredKey | null> => {
    const raw = await storage.getItem(storageKey(scope));
    if (!raw) return null;
    try { const value = JSON.parse(raw) as StoredKey; if (validKey(value.keyId) && (value.phase === "generated" || value.phase === "attested")) return value; } catch {}
    await forget(scope); return null;
  };
  const registerKey = async (context: AppleProofContext, register: (input: AppleRegistration) => Promise<void>, cached: StoredKey | null) => {
    let value = pending.get(context.keyScope);
    if (value && value.expiresAt <= Date.now()) { await forget(context.keyScope); value = undefined; cached = null; }
    if (!value) {
      const keyId = cached?.phase === "generated" ? cached.keyId : await integrity.generateKeyAsync();
      if (!validKey(keyId)) throw new NativeServiceError("native_attestation_failed");
      await storage.setItem(storageKey(context.keyScope), JSON.stringify({ keyId, phase: "generated" } satisfies StoredKey));
      const attestation = await integrity.attestKeyAsync(keyId, context.requestHash);
      value = { keyId, challenge: context.challenge, attestation, expiresAt: context.expiresAt };
      pending.set(context.keyScope, value);
      await storage.setItem(storageKey(context.keyScope), JSON.stringify({ keyId, phase: "attested" } satisfies StoredKey));
    }
    await register({ keyId: value.keyId, challenge: value.challenge, attestation: value.attestation });
    pending.delete(context.keyScope);
  };
  return { forget,
    async prove(context, register) {
      if (!integrity.isSupported) throw new NativeServiceError("native_generation_unavailable");
      if (!/^[a-f0-9]{64}$/.test(context.keyScope) || !/^[A-Za-z0-9_-]{43}$/.test(context.requestHash) || context.expiresAt <= Date.now()) throw new NativeServiceError("native_attestation_required");
      const inflight = registration.get(context.keyScope);
      if (inflight) { await inflight; return { registered: true }; }
      let cached = await load(context.keyScope);
      const started = registration.get(context.keyScope);
      if (started) { await started; return { registered: true }; }
      try {
        if (cached?.phase === "attested" && !pending.has(context.keyScope)) {
          try { return { keyId: cached.keyId, assertion: await integrity.generateAssertionAsync(cached.keyId, context.requestHash) }; }
          catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ERR_APP_INTEGRITY_INVALID_KEY") throw error; await forget(context.keyScope); cached = null; }
        }
        const task = registerKey(context, register, cached);
        registration.set(context.keyScope, task);
        try { await task; } finally { registration.delete(context.keyScope); }
        return { registered: true };
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (code !== "ERR_APP_INTEGRITY_SERVER_UNAVAILABLE" && !(error instanceof NativeServiceError && (error.code === "network" || error.code === "timeout"))) await forget(context.keyScope).catch(() => undefined);
        try { void Promise.resolve(diagnostics?.record({ operation: "integrity", stage: "attestation_request", code: "native_attestation_failed", providerCode: code })).catch(() => undefined); } catch {}
        if (error instanceof NativeServiceError) throw error;
        throw new NativeServiceError(code === "ERR_APP_INTEGRITY_SERVER_UNAVAILABLE" ? "native_generation_unavailable" : "native_attestation_failed");
      }
    },
  };
}
