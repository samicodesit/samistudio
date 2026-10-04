import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { diagnoseRequest } from "./request";
import { trackServerDiagnostic } from "./store";
vi.mock("server-only", () => ({}));
vi.mock("./store", () => ({ trackServerDiagnostic: vi.fn() }));

const id = "11111111-1111-4111-8111-111111111111";
function request(reference = id) { return new NextRequest("https://doodle.test/api/generate?secret=private", { headers: { "x-doodle-request-id": reference, "x-doodle-client": "native-android", authorization: "Bearer private-token" } }); }

describe("request failure diagnostics", () => {
  it.each([
    { path: "/api/account", operation: "account", stage: "account_read" },
    { path: "/api/native/config", operation: "integrity", stage: "config_fetch" },
  ] as const)("skips routine successful GET logs for $path while preserving its reference", async ({ path, operation, stage }) => {
    vi.mocked(trackServerDiagnostic).mockClear();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await diagnoseRequest(new Request("https://doodle.test" + path, { headers: { "x-doodle-request-id": id } }), operation, async (context) => {
      context.stage = stage;
      return Response.json({ enabled: true });
    });
    expect(response.headers.get("x-doodle-request-id")).toBe(id);
    expect(await response.json()).toEqual({ enabled: true });
    expect(info).not.toHaveBeenCalled();
    expect(trackServerDiagnostic).not.toHaveBeenCalled();
  });

  it.each([
    { path: "/api/account", operation: "account", stage: "account_read" },
    { path: "/api/native/config", operation: "integrity", stage: "config_fetch" },
  ] as const)("still records failures for $path", async ({ path, operation, stage }) => {
    vi.mocked(trackServerDiagnostic).mockClear();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await diagnoseRequest(new Request("https://doodle.test" + path), operation, async (context) => {
      context.stage = stage;
      return Response.json({ error: "auth_unavailable" }, { status: 503 });
    });
    expect(response.status).toBe(503);
    expect(error).toHaveBeenCalledTimes(1);
    expect(trackServerDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ operation, stage, code: "auth_unavailable", status: 503 }));
  });


  it("logs a sanitized successful request reference without filling the failure store", async () => {
    vi.mocked(trackServerDiagnostic).mockClear();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const requestId = "df9c4bb8-4ab8-49d6-a938-e0ed35616729";
    const response = await diagnoseRequest(new Request("https://doodle.samistudio.nl/api/generate", { headers: { "x-doodle-request-id": requestId } }), "generation", async (context) => {
      context.stage = "credit_finalize";
      context.detailLevel = "detailed";
      return new Response("image", { headers: { "content-type": "image/png" } });
    });
    expect(await response.text()).toBe("image");
    expect(info).toHaveBeenCalledWith("[doodle-diagnostics]", expect.any(String));
    expect(JSON.parse(info.mock.calls[0][1] as string)).toMatchObject({ requestId, code: "ok", status: 200, stage: "credit_finalize", detailLevel: "detailed", promptVersion: "detailed-v1" });
    expect(trackServerDiagnostic).not.toHaveBeenCalled();
  });


  it("bounds console bursts without changing responses or suppressing server errors", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-02T01:00:00Z"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      for (let i = 0; i < 80; i++) {
        const result = await diagnoseRequest(new Request("https://doodle.samistudio.nl/api/generate"), "generation", async () => Response.json({ error: "invalid_scene" }, { status: 400 }));
        expect(result.status).toBe(400);
      }
      expect(warn).toHaveBeenCalledTimes(30);
      await diagnoseRequest(new Request("https://doodle.samistudio.nl/api/generate"), "generation", async () => Response.json({ error: "timeout" }, { status: 504 }));
      expect(error).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60_001);
      await diagnoseRequest(new Request("https://doodle.samistudio.nl/api/generate"), "generation", async () => Response.json({ error: "invalid_scene" }, { status: 400 }));
      expect(warn).toHaveBeenCalledTimes(31);
    } finally { vi.useRealTimers(); }
  });

  it("correlates the same reference without changing the response body or cookies", async () => {
    const response = await diagnoseRequest(request(), "generation", async () => {
      const response = NextResponse.json({ ok: true });
      response.cookies.set("session", "private-cookie");
      return response;
    });
    expect(response.headers.get("x-doodle-request-id")).toBe(id);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain("private-cookie");
  });
  it("logs sanitized stage, code, UTC time and status for a handled failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await diagnoseRequest(request(), "generation", async (diagnostics) => {
      diagnostics.stage = "attestation_verify";
      return NextResponse.json({ error: "native_attestation_failed" }, { status: 403 });
    });
    expect(response.status).toBe(403);
    expect(warn).toHaveBeenCalledTimes(1);
    const event = JSON.parse(warn.mock.calls[0][1] as string);
    expect(event).toMatchObject({ source: "server", requestId: id, operation: "generation", stage: "attestation_verify", code: "native_attestation_failed", status: 403, channel: "android" });
    expect(event.timestamp).toMatch(/Z$/);
    expect(JSON.stringify(event)).not.toMatch(/private|authorization|cookie|secret/);
  });
  it("logs thrown failures but preserves their identity and never dumps exceptions", async () => {
    const error = new Error("private-key-and-email@example.com");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(diagnoseRequest(request("bad-reference"), "account", async () => { throw error; })).rejects.toBe(error);
    const event = JSON.parse(log.mock.calls[0][1] as string);
    expect(event.requestId).not.toBe("bad-reference");
    expect(event).toMatchObject({ code: "unhandled", status: 500, operation: "account" });
    expect(JSON.stringify(event)).not.toContain(error.message);
  });
  it("logging failures never replace successful or failed application responses", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => { throw new Error("logger down"); });
    const response = await diagnoseRequest(request(), "auth", async () => NextResponse.json({ error: "auth_unavailable" }, { status: 503 }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "auth_unavailable" });
  });
});
