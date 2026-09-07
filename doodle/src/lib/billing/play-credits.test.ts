import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPlayCredits, getPlayCreditClaim, listPlayVoidReviews, markPlayPurchaseConsumed, previewPlayPurchaseVoid, voidPlayPurchase } from "./play-credits";

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

  it("rejects a token tombstoned before it can be claimed", async () => {
    redisCommand.mockResolvedValue([-3, 0]);
    await expect(claimPlayCredits(accountId, token)).rejects.toThrow("Purchase was voided");
  });

  it("reads and marks only this account's existing claim", async () => {
    redisCommand.mockResolvedValueOnce([1, 13, "granted"]).mockResolvedValueOnce(1);
    await expect(getPlayCreditClaim(accountId, token)).resolves.toEqual({ balance: 13, state: "granted" });
    await expect(markPlayPurchaseConsumed(accountId, token)).resolves.toBeUndefined();
  });

  it("previews reconciliation without mutating and applies an atomic bounded reversal", async () => {
    redisCommand
      .mockResolvedValueOnce(accountId)
      .mockResolvedValueOnce([2, 6, 4, "consumed"])
      .mockResolvedValueOnce(accountId)
      .mockResolvedValueOnce([2, 6, 4, "consumed"]);
    const metadata = { voidedAt: "2026-09-07T10:00:00.000Z", voidedReason: 7, voidedSource: 2, voidedQuantity: 1 } as const;

    await expect(previewPlayPurchaseVoid(token, metadata)).resolves.toEqual({ status: "reversed", recovered: 6, unrecovered: 4, priorState: "consumed" });
    await expect(voidPlayPurchase(token, metadata)).resolves.toEqual({ status: "reversed", recovered: 6, unrecovered: 4, priorState: "consumed" });

    const preview = redisCommand.mock.calls[1][0] as unknown[];
    const apply = redisCommand.mock.calls[3][0] as unknown[];
    expect(preview.slice(0, 3)).toEqual(["EVAL", expect.any(String), "5"]);
    expect(String(preview[1])).toContain("ZCOUNT");
    expect(String(preview[1])).not.toContain("HSET");
    expect(apply.slice(0, 3)).toEqual(["EVAL", expect.any(String), "6"]);
    expect(String(apply[1])).toContain("ZREMRANGEBYSCORE");
    expect(String(apply[1])).toContain("DECRBY");
    expect(String(apply[1])).toContain("unrecovered");
    expect(JSON.stringify(apply)).not.toContain(token);
  });

  it("reports idempotent tombstones and refuses to overwrite a void during consume", async () => {
    redisCommand.mockResolvedValueOnce(accountId).mockResolvedValueOnce([0, 5, 5, "granted"]).mockResolvedValueOnce(-2);
    const metadata = { voidedAt: "2026-09-07T10:00:00.000Z", voidedReason: 1, voidedSource: 0, voidedQuantity: 1 } as const;
    await expect(voidPlayPurchase(token, metadata)).resolves.toEqual({ status: "already_voided", recovered: 5, unrecovered: 5, priorState: "granted" });
    await expect(markPlayPurchaseConsumed(accountId, token)).rejects.toThrow("Purchase was voided");
  });

  it("lists a bounded residual review queue by token hash without account IDs", async () => {
    const hash = createHash("sha256").update(token).digest("hex");
    redisCommand.mockResolvedValueOnce([hash]).mockResolvedValueOnce(["2026-09-07T10:00:00.000Z", "consumed", "3", "7", "7", "2"]);
    await expect(listPlayVoidReviews(20)).resolves.toEqual([{
      purchaseHash: hash, voidedAt: "2026-09-07T10:00:00.000Z", priorState: "consumed",
      recovered: 3, unrecovered: 7, voidedReason: 7, voidedSource: 2,
    }]);
    expect(redisCommand).toHaveBeenNthCalledWith(1, ["ZREVRANGE", "doodle:play:voids:review", 0, 19]);
  });
});
