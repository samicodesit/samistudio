import { describe, expect, it, vi } from "vitest";

vi.mock("@expo/app-integrity", () => ({
  prepareIntegrityTokenProviderAsync: vi.fn(),
  requestIntegrityCheckAsync: vi.fn(),
}));

import { createNativeAttestation, type AppIntegrityModule } from "./app-integrity";

const requestHash = "a".repeat(43);

function module(overrides: Partial<AppIntegrityModule> = {}): AppIntegrityModule {
  return {
    prepareIntegrityTokenProviderAsync: vi.fn().mockResolvedValue(undefined),
    requestIntegrityCheckAsync: vi.fn().mockResolvedValue("integrity-token"),
    ...overrides,
  };
}

describe("native Play Integrity diagnostics", () => {
  it("records preparation failures with the provider code and no error text", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const integrity = createNativeAttestation("123", module({
      prepareIntegrityTokenProviderAsync: vi.fn().mockRejectedValue({ code: "ERR_APP_INTEGRITY_NETWORK_ERROR", message: "secret details" }),
    }), diagnostics);

    await expect(integrity.prepare()).rejects.toBeTruthy();
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "integrity", stage: "attestation_prepare", code: "native_attestation_failed", providerCode: "ERR_APP_INTEGRITY_NETWORK_ERROR" }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("secret details");
  });

  it("records request failures and coalesces concurrent provider preparation", async () => {
    const prepare = vi.fn().mockResolvedValue(undefined);
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const integrity = createNativeAttestation("123", module({
      prepareIntegrityTokenProviderAsync: prepare,
      requestIntegrityCheckAsync: vi.fn().mockRejectedValue({ code: "ERR_APP_INTEGRITY_CLIENT_TRANSIENT_ERROR" }),
    }), diagnostics);

    await expect(Promise.all([integrity.request(requestHash), integrity.request(requestHash)])).rejects.toBeTruthy();
    expect(prepare).toHaveBeenCalledOnce();
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ stage: "attestation_request", code: "native_attestation_failed", providerCode: "ERR_APP_INTEGRITY_CLIENT_TRANSIENT_ERROR" }));
  });
});
