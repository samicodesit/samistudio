import "server-only";
import type { DetailLevel, PROMPT_VERSIONS } from "../generation/detail-level";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { redisCommand } from "@/lib/redis";
import type { ProviderFailure } from "./provider";
import type { DiagnosticCode, DiagnosticEvent, DiagnosticOperation, DiagnosticStage } from "./events";
import type { PaperCorrectionMetadata } from "../generation/paper-color-metadata";

export type ServerDiagnostic = ProviderFailure & {
  source: "server"; timestamp: string; requestId: string; operation: DiagnosticOperation;
  stage: DiagnosticStage; code: DiagnosticCode | "ok"; status: number;
  channel: "android" | "web"; durationMs: number;
  detailLevel?: DetailLevel; promptVersion?: typeof PROMPT_VERSIONS[DetailLevel];
  paperCorrection?: PaperCorrectionMetadata;
};
export const DIAGNOSTIC_RETENTION_SECONDS = 30 * 86_400;
export type IngestResult = "stored" | "rate_limited" | "unavailable";

// Atomic quotas and deduplication bound both retained events and auxiliary keys.
// Duplicate retries consume request quota but no additional retained event storage.
const INGEST = `
if tonumber(redis.call('GET', KEYS[3]) or '0') >= 60 then return -1 end
if tonumber(redis.call('GET', KEYS[4]) or '0') >= 1000 then return -1 end
local attempts = redis.call('INCR', KEYS[4])
if attempts == 1 then redis.call('EXPIRE', KEYS[4], 3600) end
local count = redis.call('INCR', KEYS[3])
if count == 1 then redis.call('EXPIRE', KEYS[3], 3600) end
local events = cjson.decode(ARGV[1])
local pending = {}
local batchSeen = {}
for _, event in ipairs(events) do
  if not batchSeen[event.id] and redis.call('SISMEMBER', KEYS[2], event.id) == 0 then
    table.insert(pending, event)
    batchSeen[event.id] = true
  end
end
if #pending == 0 then return 1 end
if redis.call('LLEN', KEYS[1]) + #pending > 1000 then return -1 end
for _, event in ipairs(pending) do
  redis.call('RPUSH', KEYS[1], cjson.encode({source='client', receivedAt=ARGV[3], event=event}))
  redis.call('SADD', KEYS[2], event.id)
end
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1
`;
const RECORD_SERVER = `
if redis.call('LLEN', KEYS[1]) >= 1000 then return 0 end
redis.call('RPUSH', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

export async function ingestClientDiagnostics(events: DiagnosticEvent[], ip: string, at = new Date()): Promise<IngestResult> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return "unavailable";
  const day = at.toISOString().slice(0, 10);
  const hour = at.toISOString().slice(0, 13);
  const client = createHmac("sha256", secret).update("diagnostics:" + hour + ":" + ip.slice(0, 256)).digest("hex");
  try {
    const result = await redisCommand([
      "EVAL", INGEST, "4", "doodle:diagnostics:client:day:" + day,
      "doodle:diagnostics:client:seen:" + day, "doodle:diagnostics:quota:" + hour + ":" + client,
      "doodle:diagnostics:attempts:" + hour,
      JSON.stringify(events), DIAGNOSTIC_RETENTION_SECONDS, at.toISOString(),
    ], AbortSignal.timeout(1_500));
    return result === 1 ? "stored" : result === -1 ? "rate_limited" : "unavailable";
  } catch { return "unavailable"; }
}
let lastRetentionWarningMinute = -1;
function warnRetentionUnavailable(): void {
  const minute = Math.floor(Date.now() / 60_000);
  if (lastRetentionWarningMinute === minute) return;
  lastRetentionWarningMinute = minute;
  try { console.warn("[doodle-diagnostics] retention_unavailable"); } catch { /* Logging is best effort. */ }
}
export async function recordServerDiagnostic(event: ServerDiagnostic): Promise<void> {
  try {
    await redisCommand([
      "EVAL", RECORD_SERVER, "1", "doodle:diagnostics:server:day:" + event.timestamp.slice(0, 10),
      JSON.stringify(event), DIAGNOSTIC_RETENTION_SECONDS,
    ], AbortSignal.timeout(1_500));
  } catch {
    warnRetentionUnavailable();
  }
}
export function trackServerDiagnostic(event: ServerDiagnostic): void {
  if (process.env.VERCEL_ENV !== "production") return;
  try { after(() => recordServerDiagnostic(event)); } catch { /* Never alter the original response. */ }
}
