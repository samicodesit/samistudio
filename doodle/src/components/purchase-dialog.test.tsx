import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSummary } from "@/app/api/account/route";
import { getCopy } from "@/lib/i18n";
import { PurchaseDialog } from "./purchase-dialog";

vi.mock("./google-sign-in-button", () => ({ GoogleSignInButton: ({ onCredential }: { onCredential(token: string): void }) => <button type="button" onClick={() => onCredential("google-token")}>Continue with Google</button> }));

const anonymous: AccountSummary = { authenticated: false, email: null, balance: 0, freeRemaining: 0 };
const signedIn: AccountSummary = { authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null };
const copy = getCopy("en");
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

function renderDialog(account = anonymous) {
  const onClose = vi.fn(); const onAccountChange = vi.fn();
  render(<PurchaseDialog open account={account} scene="A cat" locale="en" copy={copy} success={false} onClose={onClose} onAccountChange={onAccountChange} />);
  return { onClose, onAccountChange };
}

describe("PurchaseDialog", () => {
  beforeEach(() => { sessionStorage.clear(); vi.stubGlobal("location", { assign: vi.fn() }); });

  it("shows one honest fixed offer", () => {
    renderDialog();
    expect(screen.getByText("10 more doodles")).toBeVisible();
    expect(screen.getByText("€4.99")).toBeVisible();
    expect(screen.getByText("One payment. No subscription.")).toBeVisible();
    expect(screen.queryByText(/discount|per month/i)).not.toBeInTheDocument();
  });

  it("posts a Google credential, refreshes the account, then continues to Checkout", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(signedIn))
      .mockResolvedValueOnce(json({ url: "https://checkout.stripe.com/test" }));
    const { onAccountChange } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(signedIn));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/google", expect.objectContaining({ method: "POST", body: JSON.stringify({ credential: "google-token" }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/account", { cache: "no-store" });
    expect(location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/test");
  });

  it("closes after restoring an account that already has credits", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ ...signedIn, balance: 3 }));
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("closes through native cancel and backdrop", () => {
    const { onClose } = renderDialog(); const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true })); fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
