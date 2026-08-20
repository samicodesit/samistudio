import { describe, expect, it } from "vitest";
import { createSessionToken, verifyPassphrase, verifySessionToken } from "./session";

describe("session", () => {
  it("accepts the configured passphrase", () => expect(verifyPassphrase("secret", "secret")).toBe(true));

  it("rejects a different passphrase", () => expect(verifyPassphrase("wrong", "secret")).toBe(false));

  it("accepts a signed unexpired token", () => {
    const token = createSessionToken("signing-secret", 1_000);
    expect(verifySessionToken(token, "signing-secret", 1_001)).toBe(true);
  });

  it("rejects tampered and expired tokens", () => {
    const token = createSessionToken("signing-secret", 1_000);
    expect(verifySessionToken(`${token}x`, "signing-secret", 1_001)).toBe(false);
    expect(verifySessionToken(token, "signing-secret", 1_000 + 60 * 60 * 24 * 7 + 1)).toBe(false);
  });
});
