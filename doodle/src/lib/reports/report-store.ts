import "server-only";

import { createHmac } from "node:crypto";
import { redisCommand } from "@/lib/redis";
import { required } from "@/lib/env";
import type { ReportSubmission } from "./report-schema";

const REPORT_TTL_SECONDS = 2_592_000;
const COUNTER_TTL_SECONDS = 172_800;
const CLIENT_DAILY_LIMIT = 3;
const GLOBAL_DAILY_LIMIT = 20;
const MAX_INDEX_ENTRIES = 650;

const STORE_REPORT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[8])
if redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[9]) then return {-4, 0, 0} end
local clientCount = redis.call('INCR', KEYS[1])
if clientCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[7]) end
if clientCount > tonumber(ARGV[5]) then return {-1, clientCount, 0} end
local globalCount = redis.call('INCR', KEYS[2])
if globalCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[7]) end
if globalCount > tonumber(ARGV[6]) then return {-2, clientCount, globalCount} end
if not redis.call('SET', KEYS[3], ARGV[1], 'NX', 'EX', ARGV[4]) then return {-3, clientCount, globalCount} end
redis.call('ZADD', KEYS[4], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[4], ARGV[4])
return {1, clientCount, globalCount}
`;

export type StoredReport = ReportSubmission & {
  id: string;
  createdAt: string;
};

export function clientHashForReport(request: Request): string {
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  return createHmac("sha256", required("SESSION_SECRET")).update(ip).digest("hex");
}

export async function storeReport(report: StoredReport, clientHash: string): Promise<"stored" | "rate_limited" | "capacity"> {
  if (!/^[a-f0-9]{64}$/.test(clientHash)) throw new Error("Invalid report client key");
  const createdAt = Date.parse(report.createdAt);
  if (!Number.isFinite(createdAt)) throw new Error("Invalid report time");
  const day = report.createdAt.slice(0, 10);
  const result = await redisCommand([
    "EVAL",
    STORE_REPORT_SCRIPT,
    "4",
    `doodle:reports:limit:client:${day}:${clientHash}`,
    `doodle:reports:limit:global:${day}`,
    `doodle:report:${report.id}`,
    "doodle:reports:index",
    JSON.stringify(report),
    createdAt,
    report.id,
    REPORT_TTL_SECONDS,
    CLIENT_DAILY_LIMIT,
    GLOBAL_DAILY_LIMIT,
    COUNTER_TTL_SECONDS,
    createdAt - REPORT_TTL_SECONDS * 1000,
    MAX_INDEX_ENTRIES,
  ]);
  if (!Array.isArray(result) || result.length !== 3) throw new Error("Invalid report storage response");
  const status = Number(result[0]);
  if (status === 1) return "stored";
  if (status === -1 || status === -2) return "rate_limited";
  if (status === -4) return "capacity";
  throw new Error("Report storage failed");
}
