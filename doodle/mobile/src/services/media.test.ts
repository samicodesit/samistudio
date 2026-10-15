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

  it("leaves local staging failures to the correlated API record", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const media = new NativeMediaService({
      fileFactory: vi.fn(() => ({ uri: "file:///secret/doodle.png", write: vi.fn().mockRejectedValue(new Error("disk details")) })),
      randomId: () => "id",
      requestPermission: vi.fn().mockResolvedValue({ granted: true }),
      saveAsset: vi.fn(),
      sharingAvailable: vi.fn().mockResolvedValue(true),
      shareFile: vi.fn(),
      diagnostics,
    });

    await expect(media.stagePng(new Uint8Array([1]).buffer)).rejects.toMatchObject({ code: "media_unavailable" });
    expect(diagnostics.record).not.toHaveBeenCalled();
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("secret");
  });

  it("does not record an explicit photo permission denial", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const media = new NativeMediaService({
      fileFactory: vi.fn(),
      randomId: () => "id",
      requestPermission: vi.fn().mockResolvedValue({ granted: false }),
      saveAsset: vi.fn(),
      sharingAvailable: vi.fn().mockResolvedValue(true),
      shareFile: vi.fn(),
      diagnostics,
    });

    await expect(media.download("file:///cache/doodle.png")).rejects.toMatchObject({ code: "media_unavailable" });
    expect(diagnostics.record).not.toHaveBeenCalled();
  });

  it("keeps diagnostics for actual media save and share failures", async () => {
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const media = new NativeMediaService({
      fileFactory: vi.fn(),
      randomId: () => "id",
      requestPermission: vi.fn().mockResolvedValue({ granted: true }),
      saveAsset: vi.fn().mockRejectedValue(new Error("save details")),
      sharingAvailable: vi.fn().mockResolvedValue(true),
      shareFile: vi.fn().mockRejectedValue(new Error("share details")),
      diagnostics,
    });

    await expect(media.download("file:///cache/doodle.png")).rejects.toMatchObject({ code: "media_unavailable" });
    await expect(media.share("file:///cache/doodle.png")).rejects.toMatchObject({ code: "media_unavailable" });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "media", stage: "media_save", code: "media_unavailable" }));
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "media", stage: "media_share", code: "media_unavailable" }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("details");
  });
});
