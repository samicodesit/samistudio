import { expect, it, vi } from "vitest";
import OpenAI from "openai";
import sharp from "sharp";
import { generatePhotoDoodle } from "./generate-photo-doodle";

it.each(["simple", "medium", "detailed"] as const)("uses MEDIUM Flare edits and returns corrected paper for %s", async detail => {
  const png = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#f5db90" } }).png().toBuffer();
  const edit = vi.fn().mockResolvedValue({ data: [{ b64_json: png.toString("base64") }] });
  const result = await generatePhotoDoodle(Buffer.from("photo"), detail, { edit });
  expect(edit).toHaveBeenCalledOnce();
  expect(edit).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-image-2.5-flare", quality: "medium", size: "1024x1024", n: 1, output_format: "png", prompt: expect.stringContaining(`PHOTO DETAIL ${detail.toUpperCase()}`) }));
  const [red, green, blue] = await sharp(result.bytes).raw().toBuffer();
  expect([red, green, blue]).toEqual([255, 235, 138]);
});

it("maps SDK timeouts without retrying and rejects incomplete outputs", async () => {
  const edit = vi.fn().mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
  await expect(generatePhotoDoodle(Buffer.from("photo"), "simple", { edit })).rejects.toMatchObject({ kind: "timeout" });
  expect(edit).toHaveBeenCalledOnce();
  await expect(generatePhotoDoodle(Buffer.from("photo"), "simple", { edit: async () => ({ data: [] }) })).rejects.toMatchObject({ kind: "malformed" });
});
