export type NativeRequestErrorCode = "invalid_request" | "body_too_large";

export class NativeRequestError extends Error {
  constructor(public readonly code: NativeRequestErrorCode) {
    super(code);
    this.name = "NativeRequestError";
  }
}

export async function readNativeJson(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new NativeRequestError("body_too_large");
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new NativeRequestError("invalid_request");
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new NativeRequestError("body_too_large");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new NativeRequestError("invalid_request");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NativeRequestError("invalid_request");
  }
  return value as Record<string, unknown>;
}

export function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}
