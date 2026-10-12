import { NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { isDiagnosticEvent } from "@/lib/diagnostics/events";
import { ingestClientDiagnostics } from "@/lib/diagnostics/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;
const MAX_BYTES = 4_096;
const headers = { "Cache-Control": "no-store" };
class BodyTooLarge extends Error {}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new BodyTooLarge();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new BodyTooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "3600" } : {}) } });
}
export async function POST(request: Request) {
  if (request.headers.get("x-doodle-client") !== "native-android" || !hasSameOrigin(request)) return failure("forbidden", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return failure("invalid_request", 415);
  let body;
  try { body = await readBody(request); } catch (error) { return failure(error instanceof BodyTooLarge ? "request_too_large" : "invalid_request", error instanceof BodyTooLarge ? 413 : 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).join(",") !== "events") return failure("invalid_request", 400);
  const events = (body as { events: unknown }).events;
  const now = Date.now();
  if (!Array.isArray(events) || events.length < 1 || events.length > 5 || !events.every((event) =>
    isDiagnosticEvent(event) && Date.parse(event.timestamp) >= now - 7 * 86_400_000 && Date.parse(event.timestamp) <= now + 300_000
  )) return failure("invalid_request", 400);
  // Vercel supplies the trusted connecting address. Other hosts share an anonymous quota.
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "unknown";
  const result = await ingestClientDiagnostics(events, ip);
  if (result === "rate_limited") return failure("rate_limited", 429);
  if (result !== "stored") return failure("temporary_error", 503);
  return new NextResponse(null, { status: 204, headers });
}
