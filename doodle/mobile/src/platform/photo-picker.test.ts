import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ launch: vi.fn(), pending: vi.fn(), manipulate: vi.fn(), deleted: vi.fn(), prepare: vi.fn(), readBase64: vi.fn(), fileSize: 3, platform: { OS: "android" } }));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("../../modules/doodle-photo", () => ({ prepareAndroidPhoto: mocks.prepare, prepareIosPhoto: mocks.prepare }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.launch, getPendingResultAsync: mocks.pending }));
vi.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: mocks.manipulate }, SaveFormat: { JPEG: "jpeg", WEBP: "webp" } }));
vi.mock("expo-file-system", () => ({ Paths: { cache: { uri: "file:///cache/" } }, File: class { exists = true; get size() { return mocks.fileSize; } constructor(readonly uri: string) {} base64() { return mocks.readBase64(); } delete() { mocks.deleted(this.uri); } } }));
import { pickPhoto, recoverPhoto } from "./photo-picker";

beforeEach(() => { vi.clearAllMocks(); mocks.platform.OS = "android"; mocks.fileSize = 3; mocks.readBase64.mockResolvedValue("AQID"); });

it("leaves the current photo alone when the system picker is cancelled", async () => {
  mocks.launch.mockResolvedValue({ canceled: true });
  expect(await pickPhoto()).toBeNull();
  expect(mocks.manipulate).not.toHaveBeenCalled();
  expect(mocks.deleted).not.toHaveBeenCalled();
});

it("deletes the picker cache copy when an oversized photo is rejected", async () => {
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/oversized.jpg", width: 10000, height: 10000 }] });
  await expect(pickPhoto()).rejects.toThrow("tooLarge");
  expect(mocks.deleted).toHaveBeenCalledWith("file:///cache/oversized.jpg");
  expect(mocks.manipulate).not.toHaveBeenCalled();
});

it("uses the sampled Android decoder once and removes the original cache copy", async () => {
  mocks.prepare.mockResolvedValue({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/original.jpg", width: 1200, height: 800 }] });
  expect(await pickPhoto()).toEqual({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith("file:///cache/original.jpg", 20_000_000, 64_000_000, 600, 512_000);
  expect(mocks.manipulate).not.toHaveBeenCalled();
  expect(mocks.deleted).toHaveBeenCalledExactlyOnceWith("file:///cache/original.jpg");
});

it("accepts a 48 megapixel camera photo for sampled decoding", async () => {
  mocks.prepare.mockResolvedValue({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/camera.jpg", width: 8000, height: 6000 }] });
  await expect(pickPhoto()).resolves.toEqual({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
});

it.each([
  [5712, 4284, 8_000_000],
  [8064, 6048, 18_000_000],
  [8064, 6048, 90_000_000],
  [16000, 3900, 30_000_000],
])("prepares an iPhone camera original %sx%s (%s bytes) without a full-resolution JS image decode", async (width, height, fileSize) => {
  mocks.platform.OS = "ios";
  mocks.prepare.mockResolvedValue({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/camera.heic", width, height, fileSize }] });
  await expect(pickPhoto()).resolves.toEqual({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith("file:///cache/camera.heic", 128_000_000, 64_000_000, 600, 512_000);
  expect(mocks.manipulate).not.toHaveBeenCalled();
  expect(mocks.deleted).toHaveBeenCalledWith("file:///cache/camera.heic");
});

it("cleans up the picked file when decoding fails", async () => {
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/corrupt.jpg", width: 1200, height: 800 }] });
  mocks.prepare.mockRejectedValue(new Error("invalid"));
  await expect(pickPhoto()).rejects.toThrow("invalid");
  expect(mocks.deleted).toHaveBeenCalledExactlyOnceWith("file:///cache/corrupt.jpg");
});

it("maps the native size error to the localized size message", async () => {
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/bomb.jpg", width: 1200, height: 800 }] });
  mocks.prepare.mockRejectedValue({ code: "ERR_PHOTO_TOO_LARGE", message: "Native photo limit exceeded" });
  await expect(pickPhoto()).rejects.toThrow("tooLarge");
});

it("recovers a system picker result after Android recreates the activity", async () => {
  mocks.pending.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/recovered.jpg", width: 1200, height: 800 }] });
  mocks.prepare.mockResolvedValue({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  expect(await recoverPhoto(() => true)).toEqual({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  expect(mocks.launch).not.toHaveBeenCalled();
  expect(mocks.deleted).toHaveBeenCalledExactlyOnceWith("file:///cache/recovered.jpg");
});

it("discards a late recovered selection when the user already started something else", async () => {
  mocks.pending.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/recovered.jpg", width: 1200, height: 800 }] });
  expect(await recoverPhoto(() => false)).toBeNull();
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.deleted).toHaveBeenCalledExactlyOnceWith("file:///cache/recovered.jpg");
});

it.each([false, true])("releases fallback image handles and cleans up files when encoding exceeds the budget: %s", async oversized => {
  mocks.platform.OS = "web";
  mocks.fileSize = oversized ? 512_001 : 3;
  const rendered = { saveAsync: vi.fn().mockResolvedValue({ uri: "file:///cache/normalized.webp" }), release: vi.fn() };
  const context = { resize: vi.fn(), renderAsync: vi.fn().mockResolvedValue(rendered), release: vi.fn() };
  mocks.manipulate.mockReturnValue(context);
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/original.png", width: 1200, height: 800 }] });
  if (oversized) {
    await expect(pickPhoto()).rejects.toThrow("tooLarge");
    expect(mocks.deleted).toHaveBeenCalledWith("file:///cache/normalized.webp");
    expect(mocks.readBase64).not.toHaveBeenCalled();
  } else {
    expect(await pickPhoto()).toEqual({ uri: "file:///cache/normalized.webp", base64: "AQID" });
    expect(mocks.readBase64).toHaveBeenCalledOnce();
  }
  expect(rendered.saveAsync).toHaveBeenCalledExactlyOnceWith({ format: "webp", compress: 0.9, base64: false });
  expect(rendered.release).toHaveBeenCalledOnce();
  expect(context.release).toHaveBeenCalledOnce();
  expect(mocks.deleted).toHaveBeenCalledWith("file:///cache/original.png");
});
