import * as AppIntegrity from "@expo/app-integrity";
import type { NativeAttestation } from "../contracts/native";

export type AppIntegrityModule = Pick<
  typeof AppIntegrity,
  "prepareIntegrityTokenProviderAsync" | "requestIntegrityCheckAsync"
>;

export const appIntegrityModule: AppIntegrityModule = {
  prepareIntegrityTokenProviderAsync: AppIntegrity.prepareIntegrityTokenProviderAsync,
  requestIntegrityCheckAsync: AppIntegrity.requestIntegrityCheckAsync,
};

export function createNativeAttestation(projectNumber: string | null | undefined, module: AppIntegrityModule = appIntegrityModule): NativeAttestation {
  let prepared = false;
  const prepare = async () => {
    if (prepared) return;
    if (!projectNumber || !/^\d+$/.test(projectNumber)) {
      throw new Error("native_generation_unavailable");
    }
    await module.prepareIntegrityTokenProviderAsync(projectNumber);
    prepared = true;
  };
  return {
    prepare,
    async request(requestHash: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(requestHash)) throw new Error("native_attestation_required");
      await prepare();
      return module.requestIntegrityCheckAsync(requestHash);
    },
  };
}
