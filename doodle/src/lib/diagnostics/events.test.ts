import { describe, expect, it } from "vitest";
import { diagnosticCode, diagnosticProviderCode, isDiagnosticEvent } from "./events";

const event = { v: 1, id: "11111111-1111-4111-8111-111111111111", timestamp: "2026-10-02T08:01:00.000Z", appVersion: "0.1.5", build: "7", androidApi: 36, operation: "generation", stage: "http_request", code: "network" };

describe("diagnostic event contract", () => {
  it("accepts useful failure metadata without application content", () => {
    expect(isDiagnosticEvent({ ...event, status: 503, requestId: event.id, durationMs: 30000, providerCode: "ERR_APP_INTEGRITY_NETWORK_ERROR" })).toBe(true);
  });
  it("rejects arbitrary fields, messages and identifiers", () => {
    for (const field of ["message", "scene", "image", "email", "installId", "token", "url", "stack"]) expect(isDiagnosticEvent({ ...event, [field]: "private" })).toBe(false);
    expect(isDiagnosticEvent({ ...event, code: "secret-value" })).toBe(false);
    expect(isDiagnosticEvent({ ...event, providerCode: "private-provider-response" })).toBe(false);
    expect(isDiagnosticEvent({ ...event, requestId: "private-session-token" })).toBe(false);
  });
  it("rejects malformed or unbounded metadata", () => {
    for (const patch of [{ v: 2 }, { timestamp: "yesterday" }, { appVersion: "email@example.com" }, { build: "x".repeat(100) }, { androidApi: -1 }, { durationMs: 190001 }, { status: 0 }, { operation: "custom" }, { stage: "raw-message" }]) expect(isDiagnosticEvent({ ...event, ...patch })).toBe(false);
    expect(isDiagnosticEvent(null)).toBe(false);
  });
  it("never retains unknown provider or service codes", () => {
    expect(diagnosticCode("network")).toBe("network");
    expect(diagnosticCode("secret\nvalue")).toBe("unknown");
    expect(diagnosticProviderCode(10)).toBe("10");
    expect(diagnosticProviderCode("ERR_APP_INTEGRITY_NETWORK_ERROR")).toBe("ERR_APP_INTEGRITY_NETWORK_ERROR");
    expect(diagnosticProviderCode("email@example.com")).toBeUndefined();
  });
});
