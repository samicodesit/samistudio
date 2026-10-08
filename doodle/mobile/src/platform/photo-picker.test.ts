import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ launch: vi.fn(), manipulate: vi.fn(), deleted: vi.fn() }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.launch }));
vi.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: mocks.manipulate }, SaveFormat: { JPEG: "jpeg" } }));
vi.mock("expo-file-system", () => ({ Paths: { cache: { uri: "file:///cache/" } }, File: class { exists = true; constructor(readonly uri: string) {} delete() { mocks.deleted(this.uri); } } }));
import { pickPhoto } from "./photo-picker";

beforeEach(() => { vi.clearAllMocks(); });

it("leaves the current photo alone when the system picker is cancelled", async () => {
  mocks.launch.mockResolvedValue({ canceled: true });
  expect(await pickPhoto()).toBeNull();
  expect(mocks.manipulate).not.toHaveBeenCalled();
  expect(mocks.deleted).not.toHaveBeenCalled();
});

it("deletes the picker cache copy when an oversized photo is rejected", async () => {
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/oversized.jpg", width: 6000, height: 6000 }] });
  await expect(pickPhoto()).rejects.toThrow("tooLarge");
  expect(mocks.deleted).toHaveBeenCalledWith("file:///cache/oversized.jpg");
  expect(mocks.manipulate).not.toHaveBeenCalled();
});

it("normalizes once, releases image handles and removes the original cache copy", async () => {
  const rendered = { saveAsync: vi.fn().mockResolvedValue({ uri: "file:///cache/normalized.jpg", base64: "AQID" }), release: vi.fn() };
  const context = { resize: vi.fn(), renderAsync: vi.fn().mockResolvedValue(rendered), release: vi.fn() };
  mocks.manipulate.mockReturnValue(context);
  mocks.launch.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/original.jpg", width: 1200, height: 800 }] });
  expect(await pickPhoto()).toEqual({ uri: "file:///cache/normalized.jpg", base64: "AQID" });
  expect(context.resize).toHaveBeenCalledWith({ width: 600 });
  expect(rendered.release).toHaveBeenCalledOnce();
  expect(context.release).toHaveBeenCalledOnce();
  expect(mocks.deleted).toHaveBeenCalledExactlyOnceWith("file:///cache/original.jpg");
});
