import { describe, expect, it } from "vitest";
import {
  isApplePayDiagnosticEvent,
  mapApplePayAvailability,
  mapApplePayHttpStatus,
} from "./apple-pay-diagnostics";

describe("Apple Pay diagnostics", () => {
  it("maps Stripe wallet availability without guessing missing values", () => {
    expect(mapApplePayAvailability(true)).toBe("available");
    expect(mapApplePayAvailability(false)).toBe("unavailable");
    expect(mapApplePayAvailability(undefined)).toBe("missing");
  });

  it("maps HTTP responses to a bounded status enum", () => {
    expect(mapApplePayHttpStatus(200)).toBe("ok");
    expect(mapApplePayHttpStatus(403)).toBe("forbidden");
    expect(mapApplePayHttpStatus(503)).toBe("unavailable");
    expect(mapApplePayHttpStatus(418)).toBe("unknown");
  });

  it("accepts lifecycle events and rejects unallowlisted fields", () => {
    expect(isApplePayDiagnosticEvent({ stage: "express_ready", applePay: "available" })).toBe(true);
    expect(isApplePayDiagnosticEvent({ stage: "session_init", outcome: "failure", reason: "http_error", status: "forbidden" })).toBe(true);
    expect(isApplePayDiagnosticEvent({ stage: "session_init", outcome: "failure", reason: "http_error", status: "ok" })).toBe(false);
    expect(isApplePayDiagnosticEvent({ stage: "provider", outcome: "failure", reason: "provider_error", secret: "do-not-log" })).toBe(false);
    expect(isApplePayDiagnosticEvent({ stage: "express_ready", applePay: "maybe" })).toBe(false);
  });
});
