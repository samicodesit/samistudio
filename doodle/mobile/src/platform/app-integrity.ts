import * as AppIntegrity from "@expo/app-integrity";
import type { NativeAttestation } from "../contracts/native";
import type { NativeDiagnosticsSink } from "../services/diagnostics";

export type AppIntegrityModule = Pick<
  typeof AppIntegrity,
  "prepareIntegrityTokenProviderAsync" | "requestIntegrityCheckAsync"
>;

export const appIntegrityModule: AppIntegrityModule = {
  prepareIntegrityTokenProviderAsync: AppIntegrity.prepareIntegrityTokenProviderAsync,
  requestIntegrityCheckAsync: AppIntegrity.requestIntegrityCheckAsync,
};

export function createNativeAttestation(projectNumber: string | null | undefined, module: AppIntegrityModule = appIntegrityModule, diagnostics?: NativeDiagnosticsSink): NativeAttestation {
  let prepared = false;
  let preparation: Promise<void> | undefined;
  const prepare = async () => {
    if (prepared) return;
    if (!projectNumber || !/^\d+$/.test(projectNumber)) {
      record(diagnostics, "attestation_prepare", "native_generation_unavailable");
      throw new Error("native_generation_unavailable");
    }
    if (!preparation) {
      const startedAt = Date.now();
      preparation = module.prepareIntegrityTokenProviderAsync(projectNumber).then(() => {
        prepared = true;
      }).catch((error) => {
        preparation = undefined;
        record(diagnostics, "attestation_prepare", "native_attestation_failed", startedAt, providerCode(error));
        throw error;
      });
    }
    await preparation;
  };
  return {
    prepare,
    async request(requestHash: string) {
      const startedAt = Date.now();
      if (!/^[A-Za-z0-9_-]{43}$/.test(requestHash)) {
        record(diagnostics, "attestation_request", "native_attestation_required", startedAt);
        throw new Error("native_attestation_required");
      }
      await prepare();
      try {
        return await module.requestIntegrityCheckAsync(requestHash);
      } catch (error) {
        record(diagnostics, "attestation_request", "native_attestation_failed", startedAt, providerCode(error));
        throw error;
      }
    },
  };
}

function record(diagnostics: NativeDiagnosticsSink | undefined, stage: "attestation_prepare" | "attestation_request", code: unknown, startedAt = Date.now(), providerCodeValue?: unknown): void {
  try {
    void Promise.resolve(diagnostics?.record({
      operation: "integrity",
      stage,
      code,
      providerCode: providerCodeValue,
      durationMs: boundedDuration(Date.now() - startedAt),
    })).catch(() => undefined);
  } catch {
    // Diagnostics must never change the attestation result.
  }
}

function providerCode(error: unknown): unknown {
  return error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
}

function boundedDuration(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 190_000) : 0;
}
