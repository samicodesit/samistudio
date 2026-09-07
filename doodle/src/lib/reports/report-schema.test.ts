import { describe, expect, it } from "vitest";
import { ReportValidationError, parseReportSubmission } from "./report-schema";

function jpeg(width = 1, height = 1) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9,
  ]).toString("base64");
}

describe("report submission validation", () => {
  it("accepts an actionable report without private generation content", () => {
    expect(parseReportSubmission({
      reason: "violence",
      details: "The output showed an injury.",
      locale: "en",
      includeContent: false,
    })).toEqual({
      reason: "violence",
      details: "The output showed an injury.",
      locale: "en",
      includeContent: false,
    });
  });

  it("accepts a bounded JPEG and prompt only with explicit inclusion", () => {
    expect(parseReportSubmission({
      reason: "sexual",
      details: "",
      locale: "nl",
      includeContent: true,
      scene: "A cat on a chair",
      imageBase64: jpeg(640, 480),
    })).toMatchObject({
      reason: "sexual",
      locale: "nl",
      includeContent: true,
      scene: "A cat on a chair",
      image: { mimeType: "image/jpeg", width: 640, height: 480 },
    });
  });

  it.each([
    [{ reason: "", details: "", locale: "en", includeContent: false }, "invalid_reason"],
    [{ reason: "other", details: "", locale: "en", includeContent: false }, "details_required"],
    [{ reason: "hate", details: "", locale: "xx", includeContent: false }, "invalid_locale"],
    [{ reason: "hate", details: "", locale: "en", includeContent: false, scene: "private" }, "content_without_consent"],
    [{ reason: "hate", details: "", locale: "en", includeContent: false, imageBase64: jpeg() }, "content_without_consent"],
    [{ reason: "hate", details: "", locale: "en", includeContent: true, scene: "A cat", imageBase64: Buffer.from("<svg/>").toString("base64") }, "invalid_image"],
    [{ reason: "hate", details: "", locale: "en", includeContent: true, scene: "A cat", imageBase64: jpeg(641, 480) }, "invalid_image"],
  ])("rejects invalid or nonconsensual input %#", (input, code) => {
    expect(() => parseReportSubmission(input)).toThrowError(expect.objectContaining<Partial<ReportValidationError>>({ code }));
  });
});
