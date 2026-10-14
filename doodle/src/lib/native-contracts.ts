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

  let text = "";
  const reader = request.body?.getReader();
  if (!reader) throw new NativeRequestError("invalid_request");
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new NativeRequestError("body_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof NativeRequestError) throw error;
    throw new NativeRequestError("invalid_request");
  } finally { reader.releaseLock(); }

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
