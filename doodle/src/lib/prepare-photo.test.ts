// @vitest-environment node
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preparePhoto } from "./prepare-photo";

const close = vi.fn();
const drawImage = vi.fn();
const fillRect = vi.fn();
const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn(() => "data:image/jpeg;base64,AQID") };
const context = { fillStyle: "", fillRect, drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("FileReader", class {
    result: ArrayBuffer | null = null;
    onloadend?: () => void;
    readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  });
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal("createImageBitmap", vi.fn(async (_: unknown, options: ImageBitmapOptions) => ({ width: options.resizeWidth ?? 120, height: options.resizeHeight ?? 80, close })));
});
afterEach(() => vi.unstubAllGlobals());

it("rejects forged, empty and over-budget files before decoding pixels", async () => {
  for (const file of [new File(["not an image"], "photo.jpg", { type: "image/jpeg" }), new File([], "empty.png"), new File([new Uint8Array(20_000_001)], "large.jpg")]) {
    await expect(preparePhoto(file)).rejects.toThrow();
  }
  expect(createImageBitmap).not.toHaveBeenCalled();
});

it("rejects excessive pixel dimensions before decoding, even in a tiny file", async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  png.writeUInt32BE(16000, 16); png.writeUInt32BE(16000, 20);
  await expect(preparePhoto(new File([png], "bomb.png"))).rejects.toThrow("tooLarge");
  expect(createImageBitmap).not.toHaveBeenCalled();
});

it.each([1, 2, 3, 4, 5, 6, 7, 8])("requests the correctly proportioned, oriented thumbnail for JPEG orientation %s", async orientation => {
  const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "red" } }).withMetadata({ orientation }).jpeg().toBuffer();
  expect(await preparePhoto(new File([jpeg], "camera.jpg"))).toEqual({ base64: "AQID", uri: "data:image/jpeg;base64,AQID" });
  expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ imageOrientation: "from-image", resizeWidth: orientation >= 5 ? 400 : 600, resizeHeight: orientation >= 5 ? 600 : 400, resizeQuality: "high" }));
  expect(close).toHaveBeenCalledOnce();
  expect(context.fillStyle).toBe("white");
  expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(drawImage.mock.invocationCallOrder[0]);
  expect(canvas.width).toBe(0);
  expect(canvas.height).toBe(0);
});

it("accepts a valid image with missing MIME and never enlarges a small photo", async () => {
  const jpeg = await sharp({ create: { width: 120, height: 80, channels: 3, background: "red" } }).jpeg().toBuffer();
  await preparePhoto(new File([jpeg], "photo", { type: "" }));
  expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ resizeWidth: 120, resizeHeight: 80 }));
});

it("releases the decoded bitmap and canvas when encoding fails", async () => {
  const jpeg = await sharp({ create: { width: 120, height: 80, channels: 3, background: "red" } }).jpeg().toBuffer();
  canvas.toDataURL.mockImplementationOnce(() => { throw new Error("encode failed"); });
  await expect(preparePhoto(new File([jpeg], "photo.jpg"))).rejects.toThrow("encode failed");
  expect(close).toHaveBeenCalledOnce();
  expect(canvas.width).toBe(0);
});
