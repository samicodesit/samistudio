import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  platform: { OS: "ios" },
  granted: true,
  saved: [] as string[],
  shared: [] as string[],
}));

vi.mock("react-native", () => ({ Platform: state.platform }));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: { cache: {} } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "test-id" }));
vi.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: async (writeOnly: boolean) => ({ granted: writeOnly && state.granted }),
  createAssetAsync: async (uri: string) => {
    // This API reads the created PHAsset on iOS. Add-only access cannot allow that.
    if (state.platform.OS === "ios") throw new Error("Photo library read access is unavailable");
    state.saved.push(uri);
    return { id: "saved-asset" };
  },
  saveToLibraryAsync: async (uri: string) => { state.saved.push(uri); },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => true,
  shareAsync: async (uri: string) => { state.shared.push(uri); },
}));

import { createNativeMedia } from "./media";

beforeEach(() => {
  state.platform.OS = "ios";
  state.granted = true;
  state.saved = [];
  state.shared = [];
});

describe("native media permission boundary", () => {
  it("saves on iOS when only add-to-Photos access is available", async () => {
    await expect(createNativeMedia().download("file:///cache/doodle.png")).resolves.toBeUndefined();
    expect(state.saved).toEqual(["file:///cache/doodle.png"]);
  });

  it("keeps sharing usable when saving permission is denied", async () => {
    state.granted = false;
    const media = createNativeMedia();
    await expect(media.download("file:///cache/doodle.png")).rejects.toMatchObject({ code: "media_unavailable" });
    await expect(media.share("file:///cache/doodle.png")).resolves.toBeUndefined();
    expect(state.saved).toEqual([]);
    expect(state.shared).toEqual(["file:///cache/doodle.png"]);
  });

  it("preserves saving through the existing Android adapter", async () => {
    state.platform.OS = "android";
    await expect(createNativeMedia().download("file:///cache/doodle.png")).resolves.toBeUndefined();
    expect(state.saved).toEqual(["file:///cache/doodle.png"]);
  });
});
