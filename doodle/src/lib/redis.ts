import "server-only";

function unavailable(): never {
  throw new Error("Redis unavailable");
}

export async function redisCommand(command: unknown[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) unavailable();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
  } catch {
    unavailable();
  }
  if (!response.ok) unavailable();

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    unavailable();
  }
  if (!payload || typeof payload !== "object" || !("result" in payload)) unavailable();
  return payload.result;
}

export function redisInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed)) unavailable();
  return parsed;
}
