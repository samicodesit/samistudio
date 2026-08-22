import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSummary } from "@/app/api/account/route";
import { getCopy } from "@/lib/i18n";
import { AccountMenu } from "./account-menu";

const account: AccountSummary = {
  authenticated: true,
  email: "buyer@example.com",
  balance: 4,
  freeRemaining: null,
};
const anonymousAccount: AccountSummary = {
  authenticated: false,
  email: null,
  balance: 0,
  freeRemaining: 1,
};
const copy = getCopy("en").account;

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("AccountMenu", () => {
  beforeEach(() => {
  });

  it("shows the signed-in email and localized balance", async () => {
    const user = userEvent.setup();
    render(<AccountMenu account={account} locale="en" copy={copy} onAccountChange={vi.fn()} />);

    await user.click(screen.getByText("Account"));

    expect(screen.getByText("buyer@example.com")).toBeVisible();
    expect(screen.getByText("4 doodles left")).toBeVisible();
  });

  it("closes when clicking outside or pressing Escape", async () => {
    const user = userEvent.setup();
    render(<AccountMenu account={account} locale="en" copy={copy} onAccountChange={vi.fn()} />);

    await user.click(screen.getByText("Account"));
    expect(screen.getByText("buyer@example.com")).toBeVisible();

    fireEvent.pointerDown(document.body);
    expect(screen.getByText("buyer@example.com")).not.toBeVisible();

    await user.click(screen.getByText("Account"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("buyer@example.com")).not.toBeVisible();
  });

  it("signs out and refreshes the anonymous account summary", async () => {
    const user = userEvent.setup();
    const onAccountChange = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json(anonymousAccount));
    render(<AccountMenu account={account} locale="en" copy={copy} onAccountChange={onAccountChange} />);

    await user.click(screen.getByText("Account"));
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/sign-out", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/account", { cache: "no-store" });
    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(anonymousAccount));
  });

  it("warns about unused credits and cancels deletion without a request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<AccountMenu account={account} locale="en" copy={copy} onAccountChange={vi.fn()} />);

    await user.click(screen.getByText("Account"));
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(screen.getByRole("dialog", { name: "Delete account" })).toBeVisible();
    expect(screen.getByText("Deleting your account also removes any unused doodles. This can't be undone.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep account" }));

    expect(screen.queryByRole("dialog", { name: "Delete account" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns focus to the delete trigger after native Escape cancellation", async () => {
    const user = userEvent.setup();
    render(<AccountMenu account={account} locale="en" copy={copy} onAccountChange={vi.fn()} />);

    await user.click(screen.getByText("Account"));
    const deleteTrigger = screen.getByRole("button", { name: "Delete account" });
    await user.click(deleteTrigger);
    const dialog = screen.getByRole("dialog", { name: "Delete account" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep account" })).toHaveFocus());

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(deleteTrigger).toHaveFocus();
  });

  it("deletes only after explicit confirmation and refreshes account state", async () => {
    const user = userEvent.setup();
    const onAccountChange = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(anonymousAccount));
    render(<AccountMenu account={account} locale="en" copy={copy} onAccountChange={onAccountChange} />);

    await user.click(screen.getByText("Account"));
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/account", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/account", { cache: "no-store" });
    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(anonymousAccount));
    expect(screen.queryByRole("dialog", { name: "Delete account" })).not.toBeInTheDocument();
  });
});
