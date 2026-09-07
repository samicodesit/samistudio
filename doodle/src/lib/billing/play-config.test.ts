import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlayBillingConfig, playAccountId } from "./play-config";

vi.mock("server-only", () => ({}));

const accountId = "11111111-1111-4111-8111-111111111111";

describe("Play billing configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays disabled unless the feature flag is exactly true", () => {
    vi.stubEnv("PLAY_BILLING_ENABLED", "false");
    expect(getPlayBillingConfig()).toBeNull();
  });

  it("accepts only configured service-account credentials", () => {
    vi.stubEnv("PLAY_BILLING_ENABLED", "true");
    vi.stubEnv("PLAY_ACCOUNT_LINK_SECRET", "a".repeat(32));
    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", JSON.stringify({
      type: "service_account",
      client_email: "play@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n",
    }));

    expect(getPlayBillingConfig()).toMatchObject({
      packageName: "nl.samistudio.doodle",
      productId: "doodle_credits_10",
      credentials: { client_email: "play@example.iam.gserviceaccount.com" },
    });
  });

  it("fails closed when enabled credentials are malformed", () => {
    vi.stubEnv("PLAY_BILLING_ENABLED", "true");
    vi.stubEnv("PLAY_ACCOUNT_LINK_SECRET", "short");
    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "{}");
    expect(() => getPlayBillingConfig()).toThrow("Play billing is not configured");
  });

  it("derives a stable opaque account binding", () => {
    vi.stubEnv("PLAY_ACCOUNT_LINK_SECRET", "account-link-secret-with-32-bytes");
    expect(playAccountId(accountId)).toBe(
      createHmac("sha256", "account-link-secret-with-32-bytes").update(`play-account:${accountId}`).digest("hex"),
    );
  });
});
