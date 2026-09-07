import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getPlayBillingConfig, playAccountId, PLAY_PRODUCT_ID } from "@/lib/billing/play-config";
import { createPlayPublisherClient } from "@/lib/billing/play-google";
import { PlayPurchaseError, processPlayPurchase } from "@/lib/billing/play-purchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;
const headers = { "Cache-Control": "no-store" };

class BodyTooLargeError extends Error {}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("Missing body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function parseInput(value: unknown): { purchaseToken: string; productId: typeof PLAY_PRODUCT_ID } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "productId,purchaseToken") throw new Error("Invalid request");
  if (record.productId !== PLAY_PRODUCT_ID) throw new Error("Invalid request");
  if (
    typeof record.purchaseToken !== "string" ||
    record.purchaseToken.length < 16 ||
    record.purchaseToken.length > 4_096 ||
    /[\s\u0000-\u001f\u007f]/u.test(record.purchaseToken)
  ) throw new Error("Invalid request");
  return { purchaseToken: record.purchaseToken, productId: PLAY_PRODUCT_ID };
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return json({ error: "forbidden" }, 403);

  let user;
  let config;
  try {
    user = await getCurrentUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    config = getPlayBillingConfig();
    if (!config) return json({ error: "play_unavailable" }, 503);
  } catch {
    return json({ error: "play_unavailable" }, 503);
  }

  let input;
  try {
    input = parseInput(await readLimitedJson(request));
  } catch (error) {
    return error instanceof BodyTooLargeError
      ? json({ error: "request_too_large" }, 413)
      : json({ error: "invalid_request" }, 400);
  }

  try {
    const result = await processPlayPurchase({
      accountId: user.id,
      expectedObfuscatedAccountId: playAccountId(user.id),
      purchaseToken: input.purchaseToken,
      productId: input.productId,
      publisher: createPlayPublisherClient(config),
    });
    return json(result);
  } catch (error) {
    if (error instanceof PlayPurchaseError) {
      if (error.kind === "pending") return json({ error: "purchase_pending" }, 409);
      if (error.kind === "invalid") return json({ error: "invalid_purchase" }, 400);
      if (error.kind === "foreign") return json({ error: "purchase_account_mismatch" }, 403);
    }
    return json({ error: "play_unavailable" }, 503);
  }
}
