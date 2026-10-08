import "server-only";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { redisCommand } from "./redis";

export type UsageEvent = {
  metric: "drawings" | "purchases";
  channel: "web" | "android";
  id: string;
  actor: string;
  email?: string | null;
  isTest?: boolean;
};

export type GenerationOutcome = "success" | "refused" | "timeout" | "error" | "service_unavailable" | "rate_limited" | "credits_exhausted";
export type OperationEvent = {
  actor?: string;
  email?: string | null;
} & (
  | { metric: "generation"; channel: "web" | "android"; outcome: GenerationOutcome; durationMs?: number }
  | { metric: "checkout" | "wallet_setup"; channel: "web"; outcome: "created" | "error" }
);

const QA_EMAILS = new Set(["samicodesit@gmail.com", "doodlereview889@gmail.com"]);
const RETENTION_SECONDS = 366 * 86_400;
const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
});
const RECORD = `
if ARGV[4] == '1' or (ARGV[5] ~= '' and redis.call('SISMEMBER', KEYS[3], ARGV[5]) == 1) then redis.call('SADD', KEYS[3], ARGV[3]); return 0 end
if redis.call('SISMEMBER', KEYS[3], ARGV[3]) == 1 then return 0 end
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local field = ARGV[1]
if string.sub(field, 1, 9) == 'drawings:' and redis.call('SISMEMBER', KEYS[4], ARGV[3]) == 1 then field = 'gifted_' .. field end
redis.call('HINCRBY', KEYS[1], field, 1)
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;
const RECORD_OPERATION = `
if ARGV[6] ~= '' and redis.call('SISMEMBER', KEYS[2], ARGV[6]) == 1 then
  if ARGV[2] ~= '' then redis.call('SADD', KEYS[2], ARGV[2]) end
  return 0
end
if ARGV[2] ~= '' and redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then return 0 end
local field = ARGV[1]
if ARGV[2] ~= '' and redis.call('SISMEMBER', KEYS[3], ARGV[2]) == 1 then field = 'gifted:' .. field end
redis.call('HSET', KEYS[1], 'collection_version', '1')
redis.call('HINCRBY', KEYS[1], field, 1)
if ARGV[4] ~= '' then
  redis.call('HINCRBY', KEYS[1], field .. ':duration_count', 1)
  redis.call('HINCRBY', KEYS[1], field .. ':duration_ms', ARGV[4])
  redis.call('HINCRBY', KEYS[1], field .. ':' .. ARGV[5], 1)
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`;
const GENERATION_OUTCOMES = new Set<GenerationOutcome>([
  "success", "refused", "timeout", "error", "service_unavailable", "rate_limited", "credits_exhausted",
]);

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function testingEmailKey(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return normalized ? `email:${hash(normalized)}` : "";
}

// Best-effort aggregates. No prompts, images, emails or raw account/receipt IDs are stored.
export async function recordUsage(event: UsageEvent, at = new Date()): Promise<void> {
  try {
    const qa = QA_EMAILS.has(event.email?.trim().toLowerCase() ?? "");
    if (event.isTest && !qa) return;
    await redisCommand([
      "EVAL", RECORD, "4", `doodle:metrics:day:${DAY.format(at)}`,
      `doodle:metrics:seen:${hash(`${event.metric}:${event.channel}:${event.id}`)}`,
      "doodle:metrics:qa", "doodle:metrics:gifted", `${event.metric}:${event.channel}`, RETENTION_SECONDS,
      hash(event.actor), qa ? "1" : "0", testingEmailKey(event.email),
    ], AbortSignal.timeout(1_500));
  } catch {
    console.warn("[doodle-metrics] count unavailable");
  }
}

export function trackUsage(event: UsageEvent): void {
  if (process.env.VERCEL_ENV !== "production") return;
  try {
    const at = new Date();
    after(() => recordUsage(event, at));
  } catch {
    console.warn("[doodle-metrics] scheduling unavailable");
  }
}

// Request totals, not unique users. Actor hashes only check the existing QA set;
// this path stores no new operation references or visitor identifiers.
export async function recordOperation(event: OperationEvent, at = new Date()): Promise<void> {
  try {
    if (QA_EMAILS.has(event.email?.trim().toLowerCase() ?? "")) return;
    if (event.metric === "generation") {
      if (!["web", "android"].includes(event.channel) || !GENERATION_OUTCOMES.has(event.outcome)) return;
    } else if (!["checkout", "wallet_setup"].includes(event.metric) || event.channel !== "web" || !["created", "error"].includes(event.outcome)) {
      return;
    }
    const duration = event.metric === "generation" ? event.durationMs : undefined;
    const ms = typeof duration === "number" && Number.isFinite(duration) && duration >= 0 && duration <= 600_000
      ? Math.round(duration) : undefined;
    const bucket = ms === undefined ? "" : ms < 10_000 ? "under_10s" : ms < 30_000 ? "10_to_30s"
      : ms < 60_000 ? "30_to_60s" : ms < 120_000 ? "60_to_120s" : "120s_plus";
    await redisCommand([
      "EVAL", RECORD_OPERATION, "3", `doodle:metrics:operations:day:${DAY.format(at)}`, "doodle:metrics:qa", "doodle:metrics:gifted",
      `${event.metric}:${event.channel}:${event.outcome}`, event.actor ? hash(event.actor) : "", 90 * 86_400,
      ms ?? "", bucket, testingEmailKey(event.email),
    ], AbortSignal.timeout(1_500));
  } catch {
    console.warn("[doodle-metrics] operational count unavailable");
  }
}

export function trackOperation(event: OperationEvent): void {
  if (process.env.VERCEL_ENV !== "production") return;
  try {
    const at = new Date();
    after(() => recordOperation(event, at));
  } catch {
    console.warn("[doodle-metrics] operational scheduling unavailable");
  }
}
