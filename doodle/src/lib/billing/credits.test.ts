import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePaidAccount,
  finalizePaidCredit,
  fulfillCreditPack,
  getPaidBalance,
  isPaidAccountActive,
  releasePaidCredit,
  reservePaidCredit,
} from "./credits";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.command, redisInteger: (value: unknown) => Number(value) }));

const ACCOUNT_ID = "a6c1f149-6239-4b77-8d3f-7a0574bb5f40";
const RESERVATION_ID = "8bc9a7af-6b2d-4db1-9892-d36de935ea78";
const IDENTITY_KEY = "a".repeat(64);

describe("paid credits", () => {
  beforeEach(() => {
    mocks.command.mockReset();
  });

  it("reads a missing paid balance as zero", async () => {
    mocks.command.mockResolvedValue(null);

    await expect(getPaidBalance(ACCOUNT_ID)).resolves.toBe(0);
    expect(mocks.command).toHaveBeenCalledWith(["GET", `doodle:account:${ACCOUNT_ID}:balance`]);
  });

  it("reserves one balance slot with an expiring Redis hold", async () => {
    mocks.command.mockResolvedValue([1, 9]);

    await expect(reservePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toEqual({ reserved: true, remaining: 9 });
    const command = mocks.command.mock.calls[0][0];
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("ZADD"), "4"]);
    expect(command.slice(3, 7)).toEqual([
      `doodle:account:${ACCOUNT_ID}:active`,
      `doodle:account:${ACCOUNT_ID}:deleted`,
      `doodle:account:${ACCOUNT_ID}:balance`,
      `doodle:account:${ACCOUNT_ID}:holds`,
    ]);
    expect(command.at(-1)).toBe(RESERVATION_ID);
  });

  it("fails closed for inactive or deleted accounts", async () => {
    mocks.command.mockResolvedValue([-1, 0]);

    await expect(reservePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toEqual({ reserved: false, remaining: 0 });
  });

  it("finalizes a live hold exactly once", async () => {
    mocks.command.mockResolvedValue([1, 8]);

    await expect(finalizePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toEqual({ finalized: true, remaining: 8 });
    const command = mocks.command.mock.calls[0][0];
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("HSET"), "5"]);
    expect(command.at(-1)).toBe(RESERVATION_ID);
  });

  it("does not treat a missing or expired hold as finalized", async () => {
    mocks.command.mockResolvedValue([0, 0]);

    await expect(finalizePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toEqual({ finalized: false, remaining: 0 });
  });

  it("releases only an active hold", async () => {
    mocks.command.mockResolvedValue(1);

    await expect(releasePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toBe(1);
    expect(mocks.command).toHaveBeenCalledWith(expect.arrayContaining(["EVAL", expect.stringContaining("ZREM"), "1"]));
  });

  it("fulfills exactly ten credits and keeps Stripe replay idempotent", async () => {
    mocks.command.mockResolvedValueOnce([1, 10]).mockResolvedValueOnce([0, 10]);

    await expect(fulfillCreditPack(ACCOUNT_ID, "cs_paid", "pi_paid")).resolves.toBe(10);
    await expect(fulfillCreditPack(ACCOUNT_ID, "cs_paid", "pi_paid")).resolves.toBe(10);
    expect(mocks.command.mock.calls[0][0]).toEqual(expect.arrayContaining([`doodle:purchase:cs_paid`, "pi_paid"]));
  });

  it("refuses a payment after its account has been deleted", async () => {
    mocks.command.mockResolvedValue([-1, 0]);

    await expect(fulfillCreditPack(ACCOUNT_ID, "cs_paid", "pi_paid")).rejects.toThrow("Account deleted");
  });

  it("checks the account marker and deletes its ledger atomically", async () => {
    mocks.command.mockResolvedValueOnce("1").mockResolvedValueOnce(1);

    await expect(isPaidAccountActive(ACCOUNT_ID)).resolves.toBe(true);
    await deletePaidAccount(ACCOUNT_ID, IDENTITY_KEY);
    expect(mocks.command).toHaveBeenLastCalledWith(expect.arrayContaining([
      "EVAL",
      `doodle:auth:google:${IDENTITY_KEY}`,
      `doodle:account:${ACCOUNT_ID}:active`,
      `doodle:account:${ACCOUNT_ID}:balance`,
      `doodle:account:${ACCOUNT_ID}:holds`,
      `doodle:account:${ACCOUNT_ID}:finalized`,
      `doodle:account:${ACCOUNT_ID}:deleted`,
      ACCOUNT_ID,
    ]));
  });

  it("rejects malformed account ids and impossible Redis responses", async () => {
    await expect(getPaidBalance("user")).rejects.toThrow("Redis unavailable");
    mocks.command.mockResolvedValue([2, 9]);
    await expect(reservePaidCredit(ACCOUNT_ID, RESERVATION_ID)).rejects.toThrow("Redis unavailable");
  });
});
