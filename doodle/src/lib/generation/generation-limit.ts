import { createHmac } from "node:crypto";

const CLIENT_DAILY_LIMIT = 20;
const GLOBAL_DAILY_LIMIT = 200;
const COUNTER_TTL_SECONDS = 172_800;

const COUNT_SCRIPT = `
local clientCount = redis.call("INCR", KEYS[1])
if clientCount == 1 then redis.call("EXPIRE", KEYS[1], ARGV[3]) end
if clientCount > tonumber(ARGV[1]) then return {clientCount, -1} end
local globalCount = redis.call("INCR", KEYS[2])
if globalCount == 1 then redis.call("EXPIRE", KEYS[2], ARGV[3]) end
return {clientCount, globalCount}
`;

export type GenerationLimitStatus = "allowed" | "rate_limited" | "unavailable";

export async function checkGenerationLimit(request: Request): Promise<GenerationLimitStatus> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return process.env.VERCEL ? "unavailable" : "allowed";

  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const client = createHmac("sha256", process.env.SESSION_SECRET ?? token).update(ip).digest("hex");
  const day = new Date().toISOString().slice(0, 10);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        "EVAL",
        COUNT_SCRIPT,
        "2",
        `doodle:daily:client:${day}:${client}`,
        `doodle:daily:global:${day}`,
        CLIENT_DAILY_LIMIT,
        GLOBAL_DAILY_LIMIT,
        COUNTER_TTL_SECONDS,
      ]),
      cache: "no-store",
    });
    if (!response.ok) return "unavailable";

    const payload = (await response.json()) as { result?: unknown };
    if (!Array.isArray(payload.result) || payload.result.length !== 2) return "unavailable";
    const [clientCount, globalCount] = payload.result.map(Number);
    if (!Number.isFinite(clientCount) || !Number.isFinite(globalCount)) return "unavailable";

    return clientCount > CLIENT_DAILY_LIMIT || globalCount > GLOBAL_DAILY_LIMIT
      ? "rate_limited"
      : "allowed";
  } catch {
    return "unavailable";
  }
}
