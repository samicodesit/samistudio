import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientHashForReport, storeReport } from "./report-store";

const redisCommand = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({ redisCommand }));

const report = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-09-07T10:00:00.000Z",
  reason: "violence" as const,
  details: "An injury appeared.",
  locale: "en" as const,
  includeContent: false as const,
};

describe("report storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    redisCommand.mockReset();
  });

  it("derives a privacy-safe client key instead of retaining an IP address", () => {
    vi.stubEnv("SESSION_SECRET", "report-secret");
    const request = new Request("https://doodle.example/api/reports", {
      headers: { "x-vercel-forwarded-for": "203.0.113.8" },
    });

    expect(clientHashForReport(request)).toBe(
      createHmac("sha256", "report-secret").update("203.0.113.8").digest("hex"),
    );
  });

  it("stores a bounded 30-day record and prunes only expired index entries atomically", async () => {
    redisCommand.mockResolvedValue([1, 1, 1]);

    await expect(storeReport(report, "a".repeat(64))).resolves.toBe("stored");

    const command = redisCommand.mock.calls[0][0] as unknown[];
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.any(String), "4"]);
    expect(String(command[1])).toContain("ZREMRANGEBYSCORE");
    expect(String(command[1])).not.toContain("ZREMRANGEBYRANK");
    expect(String(command[1])).toContain("ZCARD");
    expect(command.slice(3, 7)).toEqual([
      expect.stringMatching(/^doodle:reports:limit:client:/),
      expect.stringMatching(/^doodle:reports:limit:global:/),
      `doodle:report:${report.id}`,
      "doodle:reports:index",
    ]);
    expect(command).toContain(2_592_000);
    expect(JSON.parse(String(command[7]))).toEqual(report);
    expect(JSON.stringify(command)).not.toContain("203.0.113.8");
  });

  it.each([[-1], [-2]])("reports a client or global limit without claiming storage", async (code) => {
    redisCommand.mockResolvedValue([code, 6, 251]);
    await expect(storeReport(report, "a".repeat(64))).resolves.toBe("rate_limited");
  });

  it("reports capacity without claiming storage or dropping a live report", async () => {
    redisCommand.mockResolvedValue([-4, 0, 0]);
    await expect(storeReport(report, "a".repeat(64))).resolves.toBe("capacity");
  });
});
