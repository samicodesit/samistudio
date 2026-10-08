import "server-only";
import { isDetailLevel, PROMPT_VERSIONS, type DetailLevel } from "../generation/detail-level";
import type { ProviderFailure } from "./provider";
import { randomUUID } from "node:crypto";
import { diagnosticCode, DIAGNOSTIC_UUID, type DiagnosticCode, type DiagnosticOperation, type DiagnosticStage } from "./events";
import { trackServerDiagnostic, type ServerDiagnostic } from "./store";
import { PAPER_CORRECTION_STATUSES, PAPER_CORRECTION_VERSION, type PaperCorrectionMetadata } from "../generation/paper-color-metadata";

export interface RequestDiagnostics extends ProviderFailure {
  requestId: string;
  detailLevel?: DetailLevel;
  stage: DiagnosticStage;
  failureCode?: DiagnosticCode;
  paperCorrection?: PaperCorrectionMetadata;
}

const logBudget = {
  info: { minute: -1, count: 0, maximum: 60 },
  warn: { minute: -1, count: 0, maximum: 30 },
  error: { minute: -1, count: 0, maximum: 60 },
};
function writeDiagnostic(event: ServerDiagnostic): void {
  const method = event.status >= 500 ? "error" : event.code === "ok" ? "info" : "warn";
  const budget = logBudget[method];
  const minute = Math.floor(Date.now() / 60_000);
  if (budget.minute !== minute) { budget.minute = minute; budget.count = 0; }
  if (budget.count >= budget.maximum) return;
  budget.count += 1;
  console[method]("[doodle-diagnostics]", JSON.stringify(event));
}

export async function diagnoseRequest<T extends Response>(
  request: Request,
  operation: DiagnosticOperation,
  handler: (diagnostics: RequestDiagnostics) => Promise<T>,
): Promise<T> {
  const incomingId = request.headers.get("x-doodle-request-id");
  const diagnostics: RequestDiagnostics = { requestId: incomingId && DIAGNOSTIC_UUID.test(incomingId) ? incomingId : randomUUID(), stage: "request_validation" };
  const startedAt = Date.now();
  const log = (status: number, code: DiagnosticCode | "ok", retain = true) => {
    const event: ServerDiagnostic = {
      source: "server", timestamp: new Date().toISOString(), requestId: diagnostics.requestId,
      operation, stage: diagnostics.stage, code, status,
      channel: request.headers.get("x-doodle-client") === "native-android" ? "android" : "web",
      durationMs: Math.min(190000, Math.max(0, Date.now() - startedAt)),
      ...(operation === "generation" && isDetailLevel(diagnostics.detailLevel) ? { detailLevel: diagnostics.detailLevel, promptVersion: PROMPT_VERSIONS[diagnostics.detailLevel] } : {}),
      ...(operation === "generation" && diagnostics.paperCorrection?.version === PAPER_CORRECTION_VERSION && PAPER_CORRECTION_STATUSES.includes(diagnostics.paperCorrection.status) && Number.isSafeInteger(diagnostics.paperCorrection.durationMs) && diagnostics.paperCorrection.durationMs >= 0 && diagnostics.paperCorrection.durationMs <= 5_000 ? {
        paperCorrection: { version: PAPER_CORRECTION_VERSION, status: diagnostics.paperCorrection.status, durationMs: diagnostics.paperCorrection.durationMs },
      } : {}),
      ...(diagnostics.providerStatus !== undefined ? { providerStatus: diagnostics.providerStatus } : {}),
      ...(diagnostics.providerCode ? { providerCode: diagnostics.providerCode } : {}),
      ...(diagnostics.providerRequestId ? { providerRequestId: diagnostics.providerRequestId } : {}),
    };
    try {
      writeDiagnostic(event);
    } catch { /* Diagnostics must never affect application behavior. */ }
    if (retain) {
      try { trackServerDiagnostic(event); } catch { /* Retention is best effort. */ }
    }
  };
  let response: T;
  try {
    response = await handler(diagnostics);
  } catch (error) {
    log(500, "unhandled");
    throw error;
  }
  try { response.headers.set("X-Doodle-Request-Id", diagnostics.requestId); } catch { /* Some response types have immutable headers. */ }
  if (response.status >= 400 || diagnostics.failureCode) {
    let code = diagnostics.failureCode ?? "unknown";
    if (!diagnostics.failureCode && response.headers.get("content-type")?.includes("application/json")) {
      try { code = diagnosticCode((await response.clone().json()).error); } catch { /* Never log raw response bodies. */ }
    }
    log(response.status, code);
  } else if (request.method !== "GET" || (operation !== "account" && diagnostics.stage !== "config_fetch")) {
    log(response.status, "ok", false);
  }
  return response;
}
