import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import {
  MAX_REPORT_BODY_BYTES,
  parseReportSubmission,
  ReportValidationError,
} from "@/lib/reports/report-schema";
import { clientHashForReport, storeReport } from "@/lib/reports/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class ReportBodyTooLargeError extends Error {}

async function readLimitedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BODY_BYTES) {
    throw new ReportBodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("missing body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REPORT_BODY_BYTES) {
      await reader.cancel();
      throw new ReportBodyTooLargeError();
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

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let submission;
  try {
    submission = parseReportSubmission(await readLimitedJson(request));
  } catch (error) {
    if (error instanceof ReportBodyTooLargeError) {
      return NextResponse.json({ error: "report_too_large" }, { status: 413 });
    }
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_report" }, { status: 400 });
  }

  const id = randomUUID();
  try {
    const status = await storeReport(
      { ...submission, id, createdAt: new Date().toISOString() },
      clientHashForReport(request),
    );
    if (status === "rate_limited") {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (status === "capacity") {
      return NextResponse.json({ error: "report_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "report_unavailable" }, { status: 503 });
  }
}
