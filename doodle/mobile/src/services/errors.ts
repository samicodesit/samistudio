export type NativeServiceErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "native_generation_unavailable"
  | "native_attestation_required"
  | "native_attestation_failed"
  | "payment_required"
  | "rate_limited"
  | "not_found"
  | "network"
  | "timeout"
  | "billing_unavailable"
  | "purchase_pending"
  | "purchase_rejected"
  | "media_unavailable"
  | "report_unavailable"
  | "auth_unavailable"
  | "auth_cancelled"
  | "unknown";

export class NativeServiceError extends Error {
  constructor(
    public readonly code: NativeServiceErrorCode,
    message: string = code,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "NativeServiceError";
  }
}

export function serviceErrorCode(error: unknown): NativeServiceErrorCode {
  if (error instanceof NativeServiceError) return error.code;
  if (error instanceof TypeError) return "network";
  return "unknown";
}
