import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPlayBillingConfig } from "@/lib/billing/play-config";
import { createPlayVoidsClient, reconcilePlayVoids, type PlayVoidsSummary } from "@/lib/billing/play-voids";
import { redisCommand, redisInteger } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const RECONCILIATION_WINDOW_MS = 30 * DAY_MS - 60_000;
const RECONCILIATION_KEY = "doodle:play:voids:reconciliation";
const VOID_REVIEW_INDEX_KEY = "doodle:play:voids:review";
const responseHeaders = { "Cache-Control": "no-store" };

const HEARTBEAT_DEFAULTS = {
  status: "unknown",
  startedAt: "",
  completedAt: "",
  failedAt: "",
  failureCode: "",
  windowStartMs: "",
  windowEndMs: "",
  mode: "",
  fetched: "0",
  alreadyVoided: "0",
  tombstoned: "0",
  reversed: "0",
  deletedAccounts: "0",
  inactiveAccounts: "0",
  recovered: "0",
  unrecovered: "0",
  residualCount: "0",
  attentionStatus: "unknown",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

function isConfiguredSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 32;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function hasBearerSecret(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(authorization.slice("Bearer ".length)), digest(secret));
}

async function writeHeartbeat(fields: Record<string, string>) {
  const completeFields = { ...HEARTBEAT_DEFAULTS, ...fields };
  const argumentsList = Object.entries(completeFields).flatMap(([key, value]) => [key, value]);
  await redisCommand(["HSET", RECONCILIATION_KEY, ...argumentsList]);
}

function windowFields(startTimeMs: number, endTimeMs: number) {
  return {
    windowStartMs: String(startTimeMs),
    windowEndMs: String(endTimeMs),
  };
}

function successFields(
  summary: PlayVoidsSummary,
  startTimeMs: number,
  endTimeMs: number,
  startedAt: string,
  completedAt: string,
  residualCount: number,
) {
  return {
    status: "ok",
    startedAt,
    completedAt,
    ...windowFields(startTimeMs, endTimeMs),
    mode: summary.mode,
    fetched: String(summary.fetched),
    alreadyVoided: String(summary.alreadyVoided),
    tombstoned: String(summary.tombstoned),
    reversed: String(summary.reversed),
    deletedAccounts: String(summary.deletedAccounts),
    inactiveAccounts: String(summary.inactiveAccounts),
    recovered: String(summary.recovered),
    unrecovered: String(summary.unrecovered),
    residualCount: String(residualCount),
    attentionStatus: residualCount > 0 ? "attention_required" : "clear",
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!isConfiguredSecret(secret)) return json({ error: "cron_unavailable" }, 503);
  if (!hasBearerSecret(request, secret)) return json({ error: "unauthorized" }, 401);

  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - RECONCILIATION_WINDOW_MS;
  const startedAt = new Date(endTimeMs).toISOString();
  let failureCode: "play_unavailable" | "reconciliation_failed" = "reconciliation_failed";

  try {
    await writeHeartbeat({
      status: "running",
      startedAt,
      ...windowFields(startTimeMs, endTimeMs),
    });

    let config;
    try {
      config = getPlayBillingConfig();
    } catch {
      failureCode = "play_unavailable";
      throw new Error("Play billing unavailable");
    }
    if (!config) {
      failureCode = "play_unavailable";
      throw new Error("Play billing unavailable");
    }

    const summary = await reconcilePlayVoids({
      client: createPlayVoidsClient(config),
      startTimeMs,
      endTimeMs,
      nowMs: endTimeMs,
      apply: true,
    });
    const residualCount = redisInteger(await redisCommand(["ZCARD", VOID_REVIEW_INDEX_KEY]));
    await writeHeartbeat(successFields(summary, startTimeMs, endTimeMs, startedAt, new Date(endTimeMs).toISOString(), residualCount));
    if (residualCount > 0) console.error("[play-void-reconciliation] attention_required");
    return json({ status: "ok", summary });
  } catch {
    try {
      await writeHeartbeat({
        status: "failed",
        failedAt: new Date(endTimeMs).toISOString(),
        failureCode,
        ...windowFields(startTimeMs, endTimeMs),
      });
    } catch {
      // The reconciliation error is already represented by the response and constant log line.
    }
    console.error("[play-void-reconciliation] failed");
    return json({ error: failureCode }, 503);
  }
}
