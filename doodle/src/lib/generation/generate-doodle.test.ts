import { describe, expect, it, vi } from "vitest";
import { generateDoodle } from "./generate-doodle";

describe("generateDoodle", () => {
  it("requests one low-quality square and decodes it", async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const generate = vi.fn().mockResolvedValue({
      data: [{ b64_json: Buffer.from(pngBytes).toString("base64") }],
    });
    const result = await generateDoodle("Two cats hug", { generate });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 1, size: "1024x1024", quality: "low" }),
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
});
