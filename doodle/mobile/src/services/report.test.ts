import { describe, expect, it, vi } from "vitest";
import { NativeReportService } from "./report";

describe("NativeReportService", () => {
  it("omits scene and image data when consent is off", async () => {
    const submit = vi.fn().mockResolvedValue({ id: "report-1" });
    const service = new NativeReportService({ submit, manipulate: vi.fn() });

    await service.submit({ locale: "en", report: { reason: "other", details: "unsafe", includeContent: false }, scene: "hidden", imageUri: "file:///doodle.png" });

    expect(submit).toHaveBeenCalledWith({ locale: "en", report: { reason: "other", details: "unsafe", includeContent: false }, scene: undefined, imageBase64: undefined });
  });

  it("resizes and compresses included content before sending it", async () => {
    const submit = vi.fn().mockResolvedValue({ id: "report-2" });
    const manipulate = vi.fn().mockResolvedValue({ uri: "file:///doodle.jpg", width: 640, height: 640, base64: "aGVsbG8=" });
    const service = new NativeReportService({ submit, manipulate });

    await service.submit({ locale: "en", report: { reason: "sexual", details: "details", includeContent: true }, scene: " Two cats hug ", imageUri: "file:///doodle.png" });

    expect(manipulate).toHaveBeenCalledWith("file:///doodle.png", [{ resize: { width: 640, height: 640 } }], expect.objectContaining({ base64: true, format: "jpeg" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ scene: "Two cats hug", imageBase64: "aGVsbG8=" }));
  });

  it("rejects included reports without both scene and image", async () => {
    const service = new NativeReportService({ submit: vi.fn(), manipulate: vi.fn() });
    await expect(service.submit({ locale: "en", report: { reason: "other", details: "unsafe", includeContent: true } })).rejects.toMatchObject({ code: "invalid_request" });
  });
});
