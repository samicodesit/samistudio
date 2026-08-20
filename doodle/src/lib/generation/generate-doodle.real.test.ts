// @vitest-environment node

import dotenv from "dotenv";
import { describe, expect, it } from "vitest";
import { generateDoodle } from "./generate-doodle";

dotenv.config({ path: ".env.local" });

describe.skipIf(process.env.RUN_REAL_IMAGE_TEST !== "1")("real Doodle image access", () => {
  it("generates a low-quality PNG through the Doodle project", async () => {
    const result = await generateDoodle("A cat holding one small umbrella");
    expect(result.mimeType).toBe("image/png");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(Array.from(result.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 180_000);
});
