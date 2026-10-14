import { describe, expect, it, vi } from "vitest";

vi.mock("expo-application", () => ({ nativeApplicationVersion: "0.1.5", nativeBuildVersion: "7" }));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: { cache: "cache", document: "document" } }));
vi.mock("expo-sharing", () => ({ shareAsync: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { Version: 36 } }));
vi.mock("./crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-000000000001" }));

import { createNativeDiagnostics, type NativeDiagnosticsFile } from "./diagnostics";
import type { NativeDiagnosticsStorage } from "../services/diagnostics";

function file(): NativeDiagnosticsFile & NativeDiagnosticsStorage & { value: string; uri: string } {
  return {
    value: "",
    uri: "file:///diagnostics.json",
    get exists() { return this.value.length > 0; },
    async text() { return this.value; },
    async read() { return this.value || null; },
    async write(value: string) { this.value = value; },
    async delete() { this.value = ""; },
    async clear() { this.value = ""; },
  };
}

function uuidSequence() {
  let next = 1;
  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

describe("native diagnostics platform", () => {
  it("keeps diagnostics local even when callers request a flush", async () => {
    const storage = file();
    const exportFile = file();
    const share = vi.fn().mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    try {
      const options = {
        storage, exportFile, share, uuid: uuidSequence(),
        metadata: { appVersion: "0.1.5", build: "7", androidApi: 36 },
      };
      const runtime = createNativeDiagnostics(options);
      await runtime.diagnostics.record({ operation: "startup", stage: "config_fetch", code: "network" });
      await runtime.diagnostics.flush();
      await runtime.diagnostics.flush();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await runtime.diagnostics.snapshot()).toHaveLength(1);
      expect(share).not.toHaveBeenCalled();
      const restarted = createNativeDiagnostics(options);
      await restarted.diagnostics.flush();
      expect(await restarted.diagnostics.snapshot()).toHaveLength(1);
      await restarted.exportAndShare();
      expect(share).toHaveBeenCalledOnce();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.parse(exportFile.value).events).toHaveLength(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("exports a local file through the existing share primitive and can clear it", async () => {
    const storage = file();
    const exportFile = file();
    exportFile.uri = "file:///export/doodle-diagnostics.json";
    const share = vi.fn().mockResolvedValue(undefined);
    const runtime = createNativeDiagnostics({
      storage, exportFile, share, uuid: uuidSequence(),
      metadata: { appVersion: "0.1.5", build: "7", androidApi: 36 },
    });

    await runtime.diagnostics.record({ operation: "auth", stage: "google_sign_in", code: "auth_unavailable", providerCode: "10" });
    await runtime.exportAndShare();
    expect(exportFile.value).toContain("google_sign_in");
    expect(share).toHaveBeenCalledWith(exportFile.uri, expect.objectContaining({ mimeType: "application/json" }));
    await runtime.clear();
    await expect(runtime.diagnostics.snapshot()).resolves.toEqual([]);
  });

  it("serializes rapid diagnostic exports while the share sheet is open", async () => {
    const storage = file();
    const exportFile = file();
    let releaseShare: (() => void) | undefined;
    const share = vi.fn(() => new Promise<void>((resolve) => { releaseShare = resolve; }));
    const runtime = createNativeDiagnostics({
      storage, exportFile, share, uuid: uuidSequence(),
      metadata: { appVersion: "0.1.5", build: "7", androidApi: 36 },
    });

    const first = runtime.exportAndShare();
    const second = runtime.exportAndShare();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(share).toHaveBeenCalledTimes(1);
    releaseShare?.();
    await first;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(share).toHaveBeenCalledTimes(2);
    releaseShare?.();
    await second;
  });
});
