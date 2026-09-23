import { describe, expect, it, vi } from "vitest";
import { NativeMediaService } from "./media";

describe("NativeMediaService", () => {
  it("stages a PNG as a local file and uses native share/download adapters", async () => {
    const write = vi.fn();
    const fileFactory = vi.fn().mockReturnValue({ uri: "file:///cache/doodle.png", write });
    const download = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockResolvedValue(undefined);
    const media = new NativeMediaService({
      fileFactory,
      randomId: () => "abc",
      requestPermission: vi.fn().mockResolvedValue({ granted: true }),
      saveAsset: download,
      sharingAvailable: vi.fn().mockResolvedValue(true),
      shareFile: share,
    });

    const uri = await media.stagePng(new Uint8Array([1, 2, 3]).buffer);
    await media.download(uri);
    await media.share(uri);

    expect(fileFactory).toHaveBeenCalledWith("doodle-abc.png");
    expect(write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(download).toHaveBeenCalledWith(uri);
    expect(share).toHaveBeenCalledWith(uri);
  });
});
