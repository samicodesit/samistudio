import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrGetGoogleAccount, deleteGoogleAccount } from "./accounts";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ command: vi.fn(), deletePaidAccount: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.command }));
vi.mock("@/lib/billing/credits", () => ({ deletePaidAccount: mocks.deletePaidAccount }));

const ACCOUNT_ID = "a6c1f149-6239-4b77-8d3f-7a0574bb5f40";

describe("Google account registry", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SESSION_SECRET", "account-secret");
    mocks.command.mockReset();
    mocks.deletePaidAccount.mockReset();
  });

  it("maps a Google subject to an opaque account id without storing the subject", async () => {
    mocks.command.mockResolvedValue(ACCOUNT_ID);

    const account = await createOrGetGoogleAccount("google-sub");
    const identityKey = createHmac("sha256", "account-secret").update("google-sub").digest("hex");

    expect(account).toEqual({ id: ACCOUNT_ID, identityKey });
    const command = mocks.command.mock.calls[0][0];
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("SET"), "1"]);
    expect(command).toContain(`doodle:auth:google:${identityKey}`);
    expect(command).not.toContain("google-sub");
    expect(command).toContain("doodle:account:");
  });

  it("fails closed when Redis does not return a valid account UUID", async () => {
    mocks.command.mockResolvedValue("not-an-account");

    await expect(createOrGetGoogleAccount("google-sub")).rejects.toThrow("Redis unavailable");
  });

  it("deletes the exact account matching its signed identity map", async () => {
    mocks.deletePaidAccount.mockResolvedValue(undefined);
    const identityKey = createHmac("sha256", "account-secret").update("google-sub").digest("hex");

    await deleteGoogleAccount({ id: ACCOUNT_ID, identityKey });

    expect(mocks.deletePaidAccount).toHaveBeenCalledWith(ACCOUNT_ID, identityKey);
  });
});
