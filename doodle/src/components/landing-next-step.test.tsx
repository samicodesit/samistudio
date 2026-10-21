import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoodlePage } from "./doodle-page";

const account = () => Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 });
const image = () => new Response(new Blob(["image"], { type: "image/png" }), { status: 200 });
async function preview() {
  const card = screen.getByRole("button", { name: /View larger:.*Birthday/i });
  card.focus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close image" }));
  expect(card).toHaveFocus();
}
const scroll = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  scroll.mockClear();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scroll });
  vi.stubGlobal("fetch", vi.fn(async () => account()));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:next-step");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  history.replaceState({}, "", "/?utm_source=test");
});

afterEach(() => vi.unstubAllGlobals());

describe("Homepage artwork previews", () => {
  it("preserves the draft by keyboard without changing input, detail level or spending credits", async () => {
    render(<DoodlePage locale="en" initialScene="A cat holding a flower" />);
    await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(screen.getByRole("button", { name: /^Detail:/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    await waitFor(() => expect(screen.queryByRole("dialog",{name:"Drawing detail"})).not.toBeInTheDocument());
    const calls = vi.mocked(fetch).mock.calls.length;
    await preview();
    expect(screen.getByRole("textbox")).toHaveValue("A cat holding a flower");
    await waitFor(() => expect(screen.getByRole("button", { name: "Detail: Medium" })).toHaveAttribute("aria-expanded", "false"));
    expect(fetch).toHaveBeenCalledTimes(calls);
    expect(location.search).toBe("?utm_source=test");
    expect(location.hash).toBe("");
  });

  it("preserves loading and the completed result without restarting or discarding generation", async () => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    vi.mocked(fetch).mockImplementation(async input => input === "/api/account" ? account() : pending);
    const { container } = render(<DoodlePage locale="en" initialScene="A cat holding a flower" />);
    await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await waitFor(() => expect(container.querySelector(".doodle-workspace-generating")).not.toBeNull());
    const calls = vi.mocked(fetch).mock.calls.length;
    await preview();
    expect(container.querySelector(".doodle-workspace-generating")).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(calls);
    await act(async () => { finish(image()); });
    const result = await screen.findByRole("img", { name: "Generated sticky-note doodle" });
    await preview();
    expect(result).toHaveAttribute("src", "blob:next-step");
    expect(container.querySelector(".doodle-workspace-ready")).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(calls);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("preserves an editable error state and retains the original idea", async () => {
    vi.mocked(fetch).mockImplementation(async input => input === "/api/account" ? account() : new Response(null, { status: 503 }));
    render(<DoodlePage locale="en" initialScene="A cat holding a flower" />);
    await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await screen.findByRole("alert");
    const calls = vi.mocked(fetch).mock.calls.length;
    await preview();
    expect(screen.getByRole("textbox")).toHaveValue("A cat holding a flower");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
