// Portable, allowlisted metadata only. Never add arbitrary messages or application content.
export const DIAGNOSTICS_PATH = "/api/native/diagnostics";
export const DIAGNOSTIC_OPERATIONS = ["account", "auth", "guest", "generation", "integrity", "billing", "media", "report", "startup"] as const;
export const DIAGNOSTIC_STAGES = ["request_validation", "session_read", "account_read", "config_fetch", "http_request", "http_response", "google_configure", "google_services", "google_sign_in", "google_token", "apple_sign_in", "apple_token", "session_create", "attestation_prepare", "attestation_request", "attestation_challenge", "attestation_verify", "credit_reserve", "rate_limit", "image_provider", "image_download", "image_stage", "credit_finalize", "credit_release", "billing_prepare", "billing_purchase", "billing_verify", "billing_consume", "billing_recover", "media_save", "media_share", "report_submit", "startup", "unknown"] as const;
export const DIAGNOSTIC_CODES = ["invalid_request", "unauthorized", "forbidden", "native_generation_unavailable", "native_attestation_required", "native_attestation_failed", "payment_required", "rate_limited", "not_found", "network", "timeout", "billing_unavailable", "purchase_pending", "purchase_rejected", "media_unavailable", "report_unavailable", "auth_unavailable", "auth_cancelled", "unknown", "limit_unavailable", "temporary_error", "refused", "malformed", "upstream", "invalid_credential", "play_unavailable", "invalid_purchase", "purchase_account_mismatch", "bot_detected", "invalid_scene", "invalid_locale", "request_too_large", "delete_failed", "unhandled", "empty", "too_long", "confirmation_required"] as const;
export const DIAGNOSTIC_PROVIDER_CODES = ["4", "7", "8", "10", "16", "12500", "12501", "12502", "IN_PROGRESS", "PLAY_SERVICES_NOT_AVAILABLE", "SIGN_IN_REQUIRED", "SIGN_IN_CANCELLED", "ERR_APP_INTEGRITY_API_NOT_AVAILABLE", "ERR_APP_INTEGRITY_APP_NOT_INSTALLED", "ERR_APP_INTEGRITY_APP_UID_MISMATCH", "ERR_APP_INTEGRITY_CANNOT_BIND_SERVICE", "ERR_APP_INTEGRITY_CLIENT_TRANSIENT_ERROR", "ERR_APP_INTEGRITY_INVALID_PROJECT_NUMBER", "ERR_APP_INTEGRITY_GOOGLE_SERVER_UNAVAILABLE", "ERR_APP_INTEGRITY_PROVIDER_INVALID", "ERR_APP_INTEGRITY_INTERNAL_ERROR", "ERR_APP_INTEGRITY_NETWORK_ERROR", "ERR_APP_INTEGRITY_PLAY_SERVICES_NOT_FOUND", "ERR_APP_INTEGRITY_PLAY_SERVICES_OUTDATED", "ERR_APP_INTEGRITY_PLAY_STORE_NOT_FOUND", "ERR_APP_INTEGRITY_PLAY_STORE_OUTDATED", "ERR_APP_INTEGRITY_REQUEST_HASH_TOO_LONG", "ERR_APP_INTEGRITY_TOO_MANY_REQUESTS", "ERR_APP_INTEGRITY_CANCELLED", "ERR_APP_INTEGRITY_PROVIDER_NOT_PREPARED", "ERR_APP_INTEGRITY_DECODE_FAILED", "ERR_APP_INTEGRITY_UNKNOWN"] as const;
export type DiagnosticOperation = typeof DIAGNOSTIC_OPERATIONS[number];
export type DiagnosticStage = typeof DIAGNOSTIC_STAGES[number];
export type DiagnosticCode = typeof DIAGNOSTIC_CODES[number];
export type DiagnosticProviderCode = typeof DIAGNOSTIC_PROVIDER_CODES[number];
export const DIAGNOSTIC_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DiagnosticEvent {
  v: 1;
  id: string;
  timestamp: string;
  appVersion: string;
  build: string;
  androidApi: number;
  operation: DiagnosticOperation;
  stage: DiagnosticStage;
  code: DiagnosticCode;
  status?: number;
  requestId?: string;
  durationMs?: number;
  providerCode?: DiagnosticProviderCode;
}
const CODES = new Set<string>(DIAGNOSTIC_CODES);
const PROVIDERS = new Set<string>(DIAGNOSTIC_PROVIDER_CODES);
const KEYS = new Set(["v", "id", "timestamp", "appVersion", "build", "androidApi", "operation", "stage", "code", "status", "requestId", "durationMs", "providerCode"]);
export function diagnosticCode(value: unknown): DiagnosticCode {
  return typeof value === "string" && CODES.has(value) ? value as DiagnosticCode : "unknown";
}
export function diagnosticProviderCode(value: unknown): DiagnosticProviderCode | undefined {
  const code = typeof value === "number" && Number.isInteger(value) ? String(value) : value;
  return typeof code === "string" && PROVIDERS.has(code) ? code as DiagnosticProviderCode : undefined;
}
function integer(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}
export function isDiagnosticEvent(value: unknown): value is DiagnosticEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return Object.keys(event).every(key => KEYS.has(key))
    && event.v === 1
    && typeof event.id === "string" && DIAGNOSTIC_UUID.test(event.id)
    && typeof event.timestamp === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.timestamp) && Number.isFinite(Date.parse(event.timestamp)) && new Date(event.timestamp).toISOString() === event.timestamp
    && typeof event.appVersion === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(event.appVersion)
    && typeof event.build === "string" && /^\d{1,10}$/.test(event.build)
    && integer(event.androidApi, 1, 1000)
    && DIAGNOSTIC_OPERATIONS.includes(event.operation as DiagnosticOperation)
    && DIAGNOSTIC_STAGES.includes(event.stage as DiagnosticStage)
    && typeof event.code === "string" && CODES.has(event.code)
    && (event.status === undefined || integer(event.status, 100, 599))
    && (event.requestId === undefined || (typeof event.requestId === "string" && DIAGNOSTIC_UUID.test(event.requestId)))
    && (event.durationMs === undefined || integer(event.durationMs, 0, 190000))
    && (event.providerCode === undefined || diagnosticProviderCode(event.providerCode) === event.providerCode);
}
