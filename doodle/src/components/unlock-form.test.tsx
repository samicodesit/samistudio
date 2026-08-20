import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnlockForm } from "./unlock-form";

describe("UnlockForm", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("prevents an empty submit", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<UnlockForm onUnlocked={vi.fn()} />);
    fireEvent.submit(screen.getByRole("button", { name: "Unlock" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows incorrect passphrase copy", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    render(<UnlockForm onUnlocked={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("That passphrase is not correct.")).toBeInTheDocument();
  });

  it("shows a generic error when the unlock service is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<UnlockForm onUnlocked={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "correct" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("Could not unlock Doodle. Please try again.")).toBeInTheDocument();
  });

  it("calls onUnlocked after a successful response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    const onUnlocked = vi.fn();
    render(<UnlockForm onUnlocked={onUnlocked} />);
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "correct" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ passphrase: "correct" }) }),
    );
  });
});
