import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSummary } from "@/app/api/account/route";
import { getCopy } from "@/lib/i18n";
import { PurchaseDialog } from "./purchase-dialog";
const play = vi.hoisted(() => ({ isPlayRuntime: vi.fn(() => false), preparePlayPurchase: vi.fn(), purchasePlayPack: vi.fn(), recoverPlayPurchases: vi.fn() }));
vi.mock("@/lib/billing/play-client", () => play);

vi.mock("./google-sign-in-button", () => ({ GoogleSignInButton: ({ onCredential }: { onCredential(token: string): void }) => <button type="button" onClick={() => onCredential("google-token")}>Continue with Google</button> }));
vi.mock("./apple-pay-checkout", () => ({ ApplePayCheckout: ({ ariaLabel, onComplete }: { ariaLabel: string; onComplete(sessionId: string): void }) => <button type="button" aria-label={ariaLabel} onClick={() => onComplete("cs_direct")}>Pay with Apple Pay</button> }));

const anonymous: AccountSummary = { authenticated: false, email: null, balance: 0, freeRemaining: 0 };
const signedIn: AccountSummary = { authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null };
const copy = getCopy("en");
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function renderDialog(account = anonymous, signInOnly = false, onExpressCheckoutComplete?: (sessionId: string) => void) {
  const onClose = vi.fn(); const onAccountChange = vi.fn();
  render(<PurchaseDialog open account={account} scene="A cat" locale="en" copy={copy} success={false} onClose={onClose} onAccountChange={onAccountChange} onExpressCheckoutComplete={onExpressCheckoutComplete} signInOnly={signInOnly} />);
  return { onClose, onAccountChange };
}

describe("PurchaseDialog", () => {
  beforeEach(() => { sessionStorage.clear(); vi.stubGlobal("location", { assign: vi.fn() }); play.isPlayRuntime.mockReturnValue(false); });

  it("shows one honest fixed offer", () => {
    renderDialog();
    expect(screen.getByText("10 more doodles")).toBeVisible();
    expect(screen.getByText("€4.99")).toBeVisible();
    expect(screen.getByText("One payment. No subscription.")).toBeVisible();
    expect(screen.queryByText(/discount|per month/i)).not.toBeInTheDocument();
  });

  it("keeps the hosted Checkout action alongside Apple Pay", () => {
    const onComplete = vi.fn();
    renderDialog(signedIn, false, onComplete);

    expect(screen.getByRole("button", { name: copy.purchase.buy })).toBeVisible();
    expect(screen.getByRole("button", { name: copy.purchase.applePay })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: copy.purchase.applePay }));
    expect(onComplete).toHaveBeenCalledWith("cs_direct");
  });

  it("shows that Checkout is opening while the request is pending", async () => {
    const user = userEvent.setup();
    const checkout = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(checkout.promise);
    renderDialog(signedIn);

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));

    const button = screen.getByRole("button", { name: "Get 10 doodles" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    checkout.resolve(json({ url: "https://checkout.stripe.com/test" }));
    await waitFor(() => expect(location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/test"));
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

  it("does not overwrite the return state during sign-in-only auth", async () => {
    const user = userEvent.setup();
    const savedReturn = JSON.stringify({ scene: "A saved checkout", intent: "checkout" });
    sessionStorage.setItem("doodle:return", savedReturn);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(signedIn));
    const { onClose } = renderDialog(anonymous, true);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sessionStorage.getItem("doodle:return")).toBe(savedReturn);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
  });

  it("keeps sign-in-only auth open when the refreshed account is still anonymous", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(anonymous));
    const { onClose } = renderDialog(anonymous, true);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.auth.authError);
    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
  });

  it("moves keyboard focus into the sign-in sheet", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    const cancel = screen.getByRole("button", { name: "Not now" });
    expect(cancel).toHaveClass("purchase-auth-cancel");
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it("opens sign-in-only sheets on the neutral heading", async () => {
    renderDialog(anonymous, true);
    const heading = screen.getByRole("heading", { name: copy.auth.signIn });
    const cancel = screen.getByRole("button", { name: copy.purchase.cancel });
    expect(heading).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(heading).toHaveFocus());
    expect(cancel).not.toHaveFocus();
  });

  it("closes through native cancel and backdrop", () => {
    const { onClose } = renderDialog(); const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true })); fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Play PurchaseDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    play.isPlayRuntime.mockReturnValue(true);
    play.preparePlayPurchase.mockResolvedValue({ product: { price: { currency: "USD", value: "5.49" } }, service: {}, obfuscatedAccountId: "a".repeat(64) });
    play.recoverPlayPurchases.mockResolvedValue({ recovered: 0, failed: 0 });
    play.purchasePlayPack.mockResolvedValue(undefined);
  });
  it("uses store pricing and does not use Stripe when Play is unavailable", async () => {
    play.preparePlayPurchase.mockRejectedValue(new Error("unavailable"));
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderDialog(signedIn);
    expect(screen.queryByText("€4.99")).not.toBeInTheDocument();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Get 10 doodles" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
  });
  it("requires a fresh buy tap after Google sign-in", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json(signedIn));
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    await screen.findByText("$5.49");
    expect(play.purchasePlayPack).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
