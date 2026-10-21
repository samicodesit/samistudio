import { describe, expect, it, vi } from "vitest";
import { generateDoodle } from "./generate-doodle";
import sharp from "sharp";

describe("generateDoodle", () => {
  it("returns a corrected provider PNG with correction metadata", async () => {
    const original = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#F5DB90" } }).png().toBuffer();
    const result = await generateDoodle("Two cats hug", { generate: async () => ({ data: [{ b64_json: original.toString("base64") }] }) });
    const pixels = await sharp(result.bytes).raw().toBuffer();
    expect([...pixels.subarray(0, 3)]).toEqual([255, 235, 138]);
    expect(result.paperCorrection).toMatchObject({ status: "corrected", version: "paper-v1" });
    expect(result.mimeType).toBe("image/png");
  });
  it("requests one medium-quality square and decodes it", async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const generate = vi.fn().mockResolvedValue({
      data: [{ b64_json: Buffer.from(pngBytes).toString("base64") }],
    });
    const result = await generateDoodle("Two cats hug", { generate });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 1, size: "1024x1024", quality: "medium" }),
    );
    expect(Array.from(result.bytes)).toEqual(Array.from(pngBytes));
    expect(result.mimeType).toBe("image/png");
  });

  it("rejects a missing image payload", async () => {
    await expect(
      generateDoodle("Two cats hug", { generate: vi.fn().mockResolvedValue({ data: [{}] }) }),
    ).rejects.toMatchObject({ kind: "malformed" });
  });

  it("rejects a non-PNG payload even when base64 decoding succeeds", async () => {
    await expect(
      generateDoodle("Two cats hug", {
        generate: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from("not a png").toString("base64") }],
        }),
      }),
    ).rejects.toMatchObject({ kind: "malformed" });
  });

  it("normalizes moderation, timeout, and upstream failures", async () => {
    await expect(
      generateDoodle("Two cats hug", {
        generate: vi.fn().mockRejectedValue({ status: 400, code: "content_policy_violation" }),
      }),
    ).rejects.toMatchObject({ kind: "refused" });

    await expect(
      generateDoodle("Two cats hug", {
        generate: vi.fn().mockRejectedValue({ name: "TimeoutError", message: "timed out" }),
      }),
    ).rejects.toMatchObject({ kind: "timeout" });

    await expect(
      generateDoodle("Two cats hug", {
        generate: vi.fn().mockRejectedValue(new Error("connection failed")),
      }),
    ).rejects.toMatchObject({ kind: "upstream" });
  });

  it("keeps provider settings identical while selecting the detail prompt", async () => {
    const generate = vi.fn().mockResolvedValue({ data: [{ b64_json: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64") }] });
    for (const level of ["simple", "medium", "detailed"] as const) await generateDoodle("Two cats hug", { generate }, level);
    const settings = generate.mock.calls.map(([input]) => { const config = { ...input }; delete config.prompt; return config; });
    expect(settings[1]).toEqual(settings[0]);
    expect(settings[2]).toEqual(settings[0]);
    expect(new Set(generate.mock.calls.map(([input]) => input.prompt)).size).toBe(3);
  });

});
