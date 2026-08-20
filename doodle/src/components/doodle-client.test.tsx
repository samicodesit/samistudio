import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DoodleClient } from "./doodle-client";

const suggestions = ["Two cats hug", "A dog with a flower", "A sleepy moon"] as const;

function renderClient() {
  return render(<DoodleClient initialAuthenticated suggestions={suggestions} />);
}

describe("DoodleClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:one");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("fills a suggestion without fetching", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /Two cats hug/ }));
    expect(screen.getByRole("textbox")).toHaveValue("Two cats hug");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves from idle to generating to ready", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Drawing your doodle...");
    await waitFor(() => expect(screen.getByAltText("Generated sticky-note doodle")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("download", "doodle.png");
  });

  it("preserves the scene when generation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 504 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A scene that takes time" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("took too long");
    expect(screen.getByRole("textbox")).toHaveValue("A scene that takes time");
  });

  it("locks on 401 while preserving the scene and returns to idle after unlock", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this scene" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(await screen.findByRole("heading", { name: "Enter the passphrase" })).toBeInTheDocument();
    expect(screen.getByLabelText("Passphrase")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "correct" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("Keep this scene"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("starts a new blank scene after a result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A finished scene" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    await screen.findByAltText("Generated sticky-note doodle");
    fireEvent.click(screen.getByRole("button", { name: /New scene/ }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByAltText(/two cats kissing upside down/)).toBeInTheDocument();
  });
});
