import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPlayCredits, getPlayCreditClaim, markPlayPurchaseConsumed } from "./play-credits";

vi.mock("server-only", () => ({}));
const redisCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/redis", () => ({
  redisCommand,
  redisInteger: (value: unknown) => Number(value),
}));

const accountId = "11111111-1111-4111-8111-111111111111";
const token = "google-play-token-123456789";

describe("Play credit ledger", () => {
  beforeEach(() => redisCommand.mockReset());

  it("atomically grants ten credits once under a token hash", async () => {
    redisCommand.mockResolvedValue([1, 10]);
    await expect(claimPlayCredits(accountId, token)).resolves.toEqual({ granted: true, balance: 10 });

    const command = redisCommand.mock.calls[0][0] as unknown[];
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.any(String), "4"]);
    expect(command.slice(3, 7)).toEqual([
      `doodle:account:${accountId}:active`,
      `doodle:account:${accountId}:deleted`,
      `doodle:account:${accountId}:balance`,
      `doodle:play:purchase:${createHash("sha256").update(token).digest("hex")}`,
    ]);
    expect(String(command[1])).toContain("INCRBY");
    expect(command).toContain(10);
    expect(JSON.stringify(command)).not.toContain(token);
  });

  it("returns the current balance without granting the same token twice", async () => {
    redisCommand.mockResolvedValue([0, 17]);
    await expect(claimPlayCredits(accountId, token)).resolves.toEqual({ granted: false, balance: 17 });
  });

  it("rejects a token ledger owned by another account", async () => {
    redisCommand.mockResolvedValue([-1, 0]);
    await expect(claimPlayCredits(accountId, token)).rejects.toThrow("Purchase belongs to another account");
  });

  it("reads and marks only this account's existing claim", async () => {
    redisCommand.mockResolvedValueOnce([1, 13, "granted"]).mockResolvedValueOnce(1);
    await expect(getPlayCreditClaim(accountId, token)).resolves.toEqual({ balance: 13, state: "granted" });
    await expect(markPlayPurchaseConsumed(accountId, token)).resolves.toBeUndefined();
  });
});
