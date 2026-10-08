import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ ingest: vi.fn() }));
vi.mock("@/lib/diagnostics/store", () => ({ ingestClientDiagnostics: mocks.ingest }));
import { POST } from "./route";
const event = { v: 1, id: "df9c4bb8-4ab8-49d6-a938-e0ed35616729", timestamp: new Date().toISOString(), appVersion: "1.0.0", build: "7", androidApi: 35, operation: "generation", stage: "http_request", code: "network" };
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://doodle.samistudio.nl/api/native/diagnostics", { method: "POST", headers: { origin: "https://doodle.samistudio.nl", "content-type": "application/json", "x-doodle-client": "native-android", ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.ingest.mockResolvedValue("stored"); });
describe("native failure ingestion", () => {
  it("accepts bounded anonymous reports without a session and never reflects them", async () => {
    const response = await POST(request({ events: [event] }));
    expect(response.status).toBe(204); expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.ingest).toHaveBeenCalledWith([event], "unknown");
  });
  it("rejects foreign origins, arbitrary fields, stale/future events and oversized batches", async () => {
    expect((await POST(request({ events: [event] }, { origin: "https://evil.example" }))).status).toBe(403);
    for (const payload of [
      { events: [{ ...event, email: "private@example.com" }] }, { events: [event], token: "secret" },
      { events: Array.from({ length: 6 }, () => event) }, { events: [] },
      { events: [{ ...event, timestamp: "2000-01-01T00:00:00.000Z" }] },
      { events: [{ ...event, timestamp: new Date(Date.now() + 3600000).toISOString() }] },
    ]) expect((await POST(request(payload))).status).toBe(400);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("bounds actual streamed bytes regardless of content-length", async () => {
    const response = await POST(request({ events: [], padding: "x".repeat(5000) }, { "content-length": "2" }));
    expect(response.status).toBe(413); expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("returns retryable failures instead of acknowledging lost reports", async () => {
    mocks.ingest.mockResolvedValueOnce("rate_limited").mockResolvedValueOnce("unavailable");
    expect((await POST(request({ events: [event] }))).status).toBe(429);
    expect((await POST(request({ events: [event] }))).status).toBe(503);
  });
});
