import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getPlayBillingConfig: vi.fn(),
  createPlayVoidsClient: vi.fn(),
  reconcilePlayVoids: vi.fn(),
  redisCommand: vi.fn(),
  redisInteger: vi.fn(),
}));

vi.mock("@/lib/billing/play-config", () => ({ getPlayBillingConfig: mocks.getPlayBillingConfig }));
vi.mock("@/lib/billing/play-voids", () => ({
  createPlayVoidsClient: mocks.createPlayVoidsClient,
  reconcilePlayVoids: mocks.reconcilePlayVoids,
}));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.redisCommand, redisInteger: mocks.redisInteger }));

const cronSecret = "c".repeat(32);
const now = Date.UTC(2026, 8, 30, 3, 17, 0);
const dayMs = 86_400_000;
const config = {
  packageName: "nl.samistudio.doodle",
  productId: "doodle_credits_10",
  credentials: { type: "service_account", client_email: "billing@example.iam.gserviceaccount.com", private_key: "private" },
};
const client = { listVoidedPurchases: vi.fn() };
const summary = {
  mode: "apply",
  fetched: 2,
  alreadyVoided: 1,
  tombstoned: 0,
  reversed: 1,
  deletedAccounts: 0,
  inactiveAccounts: 0,
  recovered: 10,
  unrecovered: 0,
};

function request(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return new Request("https://doodle.samistudio.nl/api/internal/play/reconcile-voids", { method: "GET", headers });
}

describe("Play void reconciliation route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    process.env.CRON_SECRET = cronSecret;
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getPlayBillingConfig.mockReturnValue(config);
    mocks.createPlayVoidsClient.mockReturnValue(client);
    mocks.reconcilePlayVoids.mockResolvedValue(summary);
    mocks.redisCommand.mockImplementation((command: unknown[]) => command[0] === "ZCARD" ? "0" : "OK");
    mocks.redisInteger.mockImplementation((value: unknown) => Number(value));
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.useRealTimers();
  });

  it("fails closed without a sufficiently long CRON_SECRET and performs no work", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request(`Bearer ${cronSecret}`));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cron_unavailable" });
    expect(mocks.getPlayBillingConfig).not.toHaveBeenCalled();
    expect(mocks.reconcilePlayVoids).not.toHaveBeenCalled();
    expect(mocks.redisCommand).not.toHaveBeenCalled();

    process.env.CRON_SECRET = "too-short";
    const shortSecretResponse = await GET(request("Bearer too-short"));
    expect(shortSecretResponse.status).toBe(503);
    expect(mocks.reconcilePlayVoids).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer secret before touching billing or Redis", async () => {
    const response = await GET(request("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(mocks.getPlayBillingConfig).not.toHaveBeenCalled();
    expect(mocks.reconcilePlayVoids).not.toHaveBeenCalled();
    expect(mocks.redisCommand).not.toHaveBeenCalled();
  });

  it("applies an overlapping almost-30-day window and records only a safe aggregate heartbeat", async () => {
    const response = await GET(request(`Bearer ${cronSecret}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", summary });
    expect(mocks.createPlayVoidsClient).toHaveBeenCalledWith(config);
    expect(mocks.reconcilePlayVoids).toHaveBeenCalledWith({
      client,
      startTimeMs: now - 30 * dayMs + 60_000,
      endTimeMs: now,
      nowMs: now,
      apply: true,
    });
    expect(mocks.redisCommand).toHaveBeenCalledTimes(3);
    const commands = mocks.redisCommand.mock.calls.map(([command]) => command as unknown[]);
    const heartbeatCommands = commands.filter((command) => command[0] === "HSET");
    expect(commands[1]).toEqual(["ZCARD", "doodle:play:voids:review"]);
    expect(JSON.stringify(heartbeatCommands)).not.toContain(cronSecret);
    expect(JSON.stringify(heartbeatCommands)).not.toContain("purchaseToken");
    expect(JSON.stringify(heartbeatCommands)).not.toContain("accountId");
    const asFields = (command: unknown[]) => Object.fromEntries(
      Array.from({ length: (command.length - 2) / 2 }, (_, index) => [command[2 + index * 2], command[3 + index * 2]]),
    );
    expect(asFields(heartbeatCommands[0])).toMatchObject({
      status: "running",
      startedAt: new Date(now).toISOString(),
      windowStartMs: String(now - 30 * dayMs + 60_000),
      windowEndMs: String(now),
      failureCode: "",
      fetched: "0",
      residualCount: "0",
      attentionStatus: "unknown",
    });
    expect(asFields(heartbeatCommands[1])).toMatchObject({
      status: "ok",
      startedAt: new Date(now).toISOString(),
      completedAt: new Date(now).toISOString(),
      windowStartMs: String(now - 30 * dayMs + 60_000),
      windowEndMs: String(now),
      mode: "apply",
      fetched: "2",
      alreadyVoided: "1",
      reversed: "1",
      recovered: "10",
      unrecovered: "0",
      residualCount: "0",
      attentionStatus: "clear",
    });
  });

  it("marks existing review residue for attention after an idempotent replay", async () => {
    mocks.reconcilePlayVoids.mockResolvedValue({ ...summary, fetched: 1, alreadyVoided: 1, reversed: 0, recovered: 0 });
    mocks.redisCommand.mockImplementation((command: unknown[]) => command[0] === "ZCARD" ? "1" : "OK");
    mocks.redisInteger.mockReturnValue(1);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(request(`Bearer ${cronSecret}`));
    expect(response.status).toBe(200);
    expect(consoleError).toHaveBeenCalledWith("[play-void-reconciliation] attention_required");
    const heartbeatCommand = mocks.redisCommand.mock.calls
      .map(([command]) => command as unknown[])
      .filter((command) => command[0] === "HSET")[1];
    const fields = Object.fromEntries(
      Array.from({ length: (heartbeatCommand.length - 2) / 2 }, (_, index) => [heartbeatCommand[2 + index * 2], heartbeatCommand[3 + index * 2]]),
    );
    expect(fields).toMatchObject({ status: "ok", alreadyVoided: "1", unrecovered: "0", residualCount: "1", attentionStatus: "attention_required" });
    consoleError.mockRestore();
  });

  it("returns a generic non-200 error and does not log or expose secret, token, or account details", async () => {
    const error = new Error(`private ${cronSecret} token-one-123456 account 11111111-1111-4111-8111-111111111111`);
    mocks.reconcilePlayVoids.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(request(`Bearer ${cronSecret}`));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "reconciliation_failed" });
    expect(JSON.stringify(body)).not.toContain(cronSecret);
    expect(JSON.stringify(body)).not.toContain("token-one-123456");
    expect(JSON.stringify(body)).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(consoleError).toHaveBeenCalledWith("[play-void-reconciliation] failed");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(cronSecret);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("token-one-123456");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("11111111-1111-4111-8111-111111111111");
    const heartbeatCommand = mocks.redisCommand.mock.calls
      .map(([command]) => command as unknown[])
      .filter((command) => command[0] === "HSET")[1];
    const fields = Object.fromEntries(
      Array.from({ length: (heartbeatCommand.length - 2) / 2 }, (_, index) => [heartbeatCommand[2 + index * 2], heartbeatCommand[3 + index * 2]]),
    );
    expect(fields).toMatchObject({
      status: "failed",
      failureCode: "reconciliation_failed",
      completedAt: "",
      mode: "",
      fetched: "0",
      recovered: "0",
      unrecovered: "0",
      residualCount: "0",
      attentionStatus: "unknown",
    });
    consoleError.mockRestore();
  });
});
