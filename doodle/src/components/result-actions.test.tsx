import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { ResultActions } from "./result-actions";

const track = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track }));

function setup(onTryAgain = vi.fn()) {
  render(<ResultActions imageUrl="blob:one" imageFile={new File(["image"], "doodle.png", { type: "image/png" })} scene="A happy dog" locale="en" onTryAgain={onTryAgain} onNewScene={vi.fn()} copy={getCopy("en").actions} />);
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("sharing a finished doodle", () => {
  it("uses native link sharing when the complete file payload is unsupported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: (data: ShareData) => !(data.files && data.url) });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Share doodle" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share.mock.calls[0][0]).not.toHaveProperty("files");
    expect(track).toHaveBeenCalledWith("Doodle Shared", { method: "link", locale: "en" });
  });

  it("shares the image and a clean app link without the private prompt or account parameters", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Share doodle" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share.mock.calls[0][0]).toMatchObject({ url: "https://doodle.samistudio.nl/?utm_source=doodle&utm_medium=share&utm_campaign=made_with_doodle", files: [expect.any(File)] });
    expect(track).toHaveBeenCalledWith("Doodle Shared", { method: "file", locale: "en" });
  });

  it("copies the app link when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Share doodle" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Link copied");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("utm_medium=share"));
  });

  it("does not copy or report success when the person cancels sharing", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")), clipboard: { writeText } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Share doodle" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Share doodle" })).toBeEnabled());
    expect(writeText).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("shows a selectable link when clipboard access is denied", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Share doodle" }));
    expect(await screen.findByRole("textbox", { name: "Link to Doodle" })).toHaveValue("https://doodle.samistudio.nl/?utm_source=doodle&utm_medium=share&utm_campaign=made_with_doodle");
  });
});

it("opens reporting without sending a request and resets it after cancellation", () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  setup();
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.click(screen.getByRole("button", { name: "Report this doodle" }));
  expect(screen.getByRole("dialog", { name: "Report this doodle" })).toBeVisible();
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Why are you reporting this doodle?"), { target: { value: "other" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.click(screen.getByRole("button", { name: "Report this doodle" }));
  expect(screen.getByLabelText("Why are you reporting this doodle?")).toHaveValue("");
  expect(request).not.toHaveBeenCalled();
});


it("keeps utility actions inside More options and closes it before redrawing", () => {
  const redraw = vi.fn();
  setup(redraw);
  expect(screen.queryByRole("button", { name: "Redraw this idea" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Report this doodle" })).not.toBeInTheDocument();
  const more = screen.getByRole("button", { name: "More options" });
  fireEvent.click(more);
  expect(screen.getByRole("dialog", { name: "More options" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(more).toHaveFocus();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole("button", { name: "Redraw this idea" }));
  expect(redraw).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("opens the local card composer from More options and keeps the source prompt out of the UI", async () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  setup();
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.click(screen.getByRole("button", { name: "Make a card" }));
  expect(screen.getByRole("dialog", { name: "Add a little message" })).toBeVisible();
  expect(screen.getByLabelText("Your message (optional)")).toHaveValue("");
  expect(screen.queryByText("A happy dog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close card" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a little message" })).not.toBeInTheDocument());
  expect(request).not.toHaveBeenCalled();
});
