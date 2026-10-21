export const APPLE_PAY_DIAGNOSTIC_PATH = "/api/checkout/diagnostic";

export type ApplePayAvailability = "available" | "unavailable" | "missing";
export type ApplePayHttpStatus =
  | "ok"
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "server_error"
  | "unavailable"
  | "unknown";

export type ApplePayDiagnosticEvent =
  | { stage: "session_init"; outcome: "success"; status: "ok" }
  | {
      stage: "session_init";
      outcome: "failure";
      reason: "http_error" | "invalid_response" | "network_error";
      status: ApplePayHttpStatus;
    }
  | { stage: "stripe_init"; outcome: "success"; reason: "loaded" }
  | {
      stage: "stripe_init";
      outcome: "failure";
      reason: "missing_key" | "load_error" | "null_stripe";
    }
  | { stage: "provider"; outcome: "success"; reason: "ready" }
  | { stage: "provider"; outcome: "failure"; reason: "provider_error" }
  | { stage: "express_ready"; applePay: ApplePayAvailability }
  | { stage: "availability_change"; applePay: ApplePayAvailability }
  | { stage: "element_load"; outcome: "failure"; reason: "load_error" };

const HTTP_STATUSES = [
  "ok",
  "bad_request",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "server_error",
  "unavailable",
  "unknown",
] as const satisfies readonly ApplePayHttpStatus[];

const AVAILABILITIES = ["available", "unavailable", "missing"] as const satisfies readonly ApplePayAvailability[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isOneOf<const T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function isApplePayDiagnosticEvent(value: unknown): value is ApplePayDiagnosticEvent {
  if (!isRecord(value) || typeof value.stage !== "string") return false;

  switch (value.stage) {
    case "session_init":
      if (value.outcome === "success") {
        return hasExactKeys(value, ["stage", "outcome", "status"]) && value.status === "ok";
      }
      return (
        hasExactKeys(value, ["stage", "outcome", "reason", "status"]) &&
        value.outcome === "failure" &&
        isOneOf(value.reason, ["http_error", "invalid_response", "network_error"] as const) &&
        isOneOf(value.status, HTTP_STATUSES) &&
        value.status !== "ok"
      );
    case "stripe_init":
      if (value.outcome === "success") {
        return hasExactKeys(value, ["stage", "outcome", "reason"]) && value.reason === "loaded";
      }
      return (
        hasExactKeys(value, ["stage", "outcome", "reason"]) &&
        value.outcome === "failure" &&
        isOneOf(value.reason, ["missing_key", "load_error", "null_stripe"] as const)
      );
    case "provider":
      return (
        hasExactKeys(value, ["stage", "outcome", "reason"]) &&
        ((value.outcome === "success" && value.reason === "ready") ||
          (value.outcome === "failure" && value.reason === "provider_error"))
      );
    case "express_ready":
    case "availability_change":
      return hasExactKeys(value, ["stage", "applePay"]) && isOneOf(value.applePay, AVAILABILITIES);
    case "element_load":
      return hasExactKeys(value, ["stage", "outcome", "reason"]) && value.outcome === "failure" && value.reason === "load_error";
    default:
      return false;
  }
}

export function mapApplePayAvailability(value: boolean | undefined): ApplePayAvailability {
  return value === true ? "available" : value === false ? "unavailable" : "missing";
}

export function mapApplePayHttpStatus(status: number): ApplePayHttpStatus {
  if (status >= 200 && status < 300) return "ok";
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 503) return "unavailable";
  if (status >= 500 && status < 600) return "server_error";
  return "unknown";
}
