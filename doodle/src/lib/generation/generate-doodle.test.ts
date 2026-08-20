import { describe, expect, it, vi } from "vitest";
import { generateDoodle } from "./generate-doodle";

describe("generateDoodle", () => {
  it("requests one low-quality square and decodes it", async () => {
    const generate = vi.fn().mockResolvedValue({
      data: [{ b64_json: Buffer.from("png").toString("base64") }],
    });
    const result = await generateDoodle("Two cats hug", { generate });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 1, size: "1024x1024", quality: "low" }),
    );
    expect(Buffer.from(result.bytes).toString()).toBe("png");
    expect(result.mimeType).toBe("image/png");
  });

  it("rejects a missing image payload", async () => {
    await expect(
      generateDoodle("Two cats hug", { generate: vi.fn().mockResolvedValue({ data: [{}] }) }),
    ).rejects.toMatchObject({ kind: "malformed" });
  });
});
