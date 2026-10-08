import { describe, expect, it } from "vitest";
import { providerFailure } from "./provider";
describe("provider failure metadata", () => {
  it("retains only useful allowlisted codes, numeric status and provider request references", () => {
    expect(providerFailure({ status: 429, code: "insufficient_quota", request_id: "req_abc123", message: "private prompt", apiKey: "secret" })).toEqual({ providerStatus: 429, providerCode: "insufficient_quota", providerRequestId: "req_abc123" });
  });
  it("supports the SDK requestID property", () => {
    expect(providerFailure({ status: 500, requestID: "req_sdk123" })).toEqual({ providerStatus: 500, providerRequestId: "req_sdk123" });
  });
  it("drops arbitrary values and raw exceptions", () => {
    expect(providerFailure({ status: "401", code: "private@example.com", request_id: "bearer-secret", message: "private" })).toEqual({});
    expect(providerFailure(new Error("secret"))).toEqual({});
  });
});
