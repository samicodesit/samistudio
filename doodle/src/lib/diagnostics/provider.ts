const CODES = ["insufficient_quota", "rate_limit_exceeded", "invalid_api_key", "model_not_found", "server_error", "content_policy_violation", "moderation_blocked", "ETIMEDOUT", "ECONNABORTED", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"] as const;
export type ProviderFailure = { providerStatus?: number; providerCode?: typeof CODES[number]; providerRequestId?: string };
export function providerFailure(error: unknown): ProviderFailure {
  if (!error || typeof error !== "object") return {};
  const value = error as { status?: unknown; code?: unknown; request_id?: unknown; requestID?: unknown };
  const requestId = value.requestID ?? value.request_id;
  return {
    ...(typeof value.status === "number" && Number.isInteger(value.status) && value.status >= 400 && value.status <= 599 ? { providerStatus: value.status } : {}),
    ...(typeof value.code === "string" && CODES.includes(value.code as typeof CODES[number]) ? { providerCode: value.code as typeof CODES[number] } : {}),
    ...(typeof requestId === "string" && /^req_[A-Za-z0-9_-]{1,80}$/.test(requestId) ? { providerRequestId: requestId } : {}),
  };
}
