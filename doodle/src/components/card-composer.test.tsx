import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { CardComposer } from "./card-composer";

const renderCardBlob = vi.hoisted(() => vi.fn(async () => new Blob(["png"], { type: "image/png" })));
const canShareCard = vi.hoisted(() => vi.fn(() => false));
const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/card/render-card", () => ({
  countGraphemes: (value: string) => Array.from(value).length,
  limitCardMessage: (value: string) => Array.from(value).slice(0, 80).join(""),
  renderCardBlob,
  canShareCard,
}));
vi.mock("@vercel/analytics", () => ({ track }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function stubObjectUrl() {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:card");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
}

describe("local card composer", () => {
  it("prepares one local download, limits the message, and previews the exact export asset", async () => {
    const onClose = vi.fn();
    const imageFile = new File(["image"], "doodle.png", { type: "image/png" });
    stubObjectUrl();
    render(<CardComposer imageUrl="blob:doodle" imageFile={imageFile} locale="en" copy={getCopy("en").card} onClose={onClose} />);

    const message = screen.getByLabelText("Your message (optional)");
    fireEvent.change(message, { target: { value: "A".repeat(81) } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Download card" })).toBeEnabled());
    expect(message).toHaveValue("A".repeat(80));
    expect(renderCardBlob).toHaveBeenLastCalledWith(imageFile, "A".repeat(80), "en");
    expect(screen.getAllByRole("button", { name: "Download card" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Share card" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sharing is unavailable here. Download the card instead.")).not.toBeInTheDocument();
    expect(document.querySelector(".card-preview-rendered")).toHaveAttribute("src", "blob:card");
    expect(track).toHaveBeenCalledWith("Doodle Card Opened");

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Download card" }));
    expect(track).toHaveBeenCalledWith("Doodle Card Download Requested");

    fireEvent.click(screen.getByRole("button", { name: "Close card" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shares only the generated local file when file sharing is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    stubObjectUrl();
    canShareCard.mockReturnValue(true);
    const imageFile = new File(["image"], "doodle.png", { type: "image/png" });
    render(<CardComposer imageUrl="blob:doodle" imageFile={imageFile} locale="en" copy={getCopy("en").card} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share card" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Share card" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share.mock.calls[0][0]).toMatchObject({ files: [expect.any(File)] });
    expect(canShareCard).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Doodle card", text: expect.any(String), url: expect.stringContaining("utm_medium=share"), files: [expect.any(File)] }));
    expect(share.mock.calls[0][0].url).toContain("utm_medium=share");
    expect(share.mock.calls[0][0].text).not.toContain("A happy dog");
    expect(track).toHaveBeenCalledWith("Doodle Card Shared");
  });

  it("does not count a cancelled native card share", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    vi.stubGlobal("navigator", { share, canShare: () => true });
    stubObjectUrl();
    canShareCard.mockReturnValue(true);
    const imageFile = new File(["image"], "doodle.png", { type: "image/png" });
    render(<CardComposer imageUrl="blob:doodle" imageFile={imageFile} locale="en" copy={getCopy("en").card} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share card" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Share card" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(track).not.toHaveBeenCalledWith("Doodle Card Shared");
  });

  it("shows a share error without downloading after a failed native share", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share failed"));
    vi.stubGlobal("navigator", { share, canShare: () => true });
    stubObjectUrl();
    canShareCard.mockReturnValue(true);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const imageFile = new File(["image"], "doodle.png", { type: "image/png" });
    render(<CardComposer imageUrl="blob:doodle" imageFile={imageFile} locale="en" copy={getCopy("en").card} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share card" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Share card" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sharing is unavailable here");
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Download card" })).toBeEnabled();
  });

  it("keeps the last completed preview visible while a new export is preparing", async () => {
    let resolveSecond: ((blob: Blob) => void) | undefined;
    renderCardBlob
      .mockImplementationOnce(async () => new Blob(["first"], { type: "image/png" }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    stubObjectUrl();
    const imageFile = new File(["image"], "doodle.png", { type: "image/png" });
    render(<CardComposer imageUrl="blob:doodle" imageFile={imageFile} locale="en" copy={getCopy("en").card} onClose={vi.fn()} />);

    const downloadButton = screen.getByRole("button", { name: "Download card" });
    await waitFor(() => expect(downloadButton).toBeEnabled());
    const preview = document.querySelector(".card-preview-rendered");
    expect(preview).toHaveAttribute("src", "blob:card");

    fireEvent.change(screen.getByLabelText("Your message (optional)"), { target: { value: "A new note" } });
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(2));
    expect(document.querySelector(".card-preview-rendered")).toHaveAttribute("src", "blob:card");
    expect(downloadButton).toBeDisabled();

    resolveSecond?.(new Blob(["second"], { type: "image/png" }));
    await waitFor(() => expect(downloadButton).toBeEnabled());
  });

  it("keeps native share visible and reserves the status row while a new export is preparing", async () => {
    let resolveSecond: ((blob: Blob) => void) | undefined;
    renderCardBlob
      .mockImplementationOnce(async () => new Blob(["first"], { type: "image/png" }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    canShareCard.mockReturnValue(true);
    stubObjectUrl();
    const imageFile = new File(["image"], "doodle.png", { type: "image/png" });
    render(<CardComposer imageUrl="blob:doodle" imageFile={imageFile} locale="en" copy={getCopy("en").card} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Share card" })).toBeEnabled());
    const actions = document.querySelector(".card-composer-actions");
    expect(actions).not.toHaveClass("is-single");
    fireEvent.change(screen.getByLabelText("Your message (optional)"), { target: { value: "A new note" } });
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Share card" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download card" })).toBeDisabled();
    expect(actions).not.toHaveClass("is-single");
    expect(document.querySelector(".card-composer-status-slot")).toBeInTheDocument();
    resolveSecond?.(new Blob(["second"], { type: "image/png" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Share card" })).toBeEnabled());
  });
});
