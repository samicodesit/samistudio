import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplePayCheckout } from "./apple-pay-checkout";

const stripe = vi.hoisted(() => ({
  confirm: vi.fn(),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="checkout-provider">{children}</div>,
  useCheckoutElements: () => ({ type: "success", checkout: { confirm: stripe.confirm } }),
  ExpressCheckoutElement: (props: {
    onReady?: (event: { availablePaymentMethods?: { applePay: boolean } }) => void;
    onAvailablePaymentMethodsChange?: (event: { paymentMethods: { applePay: { available: boolean } } }) => void;
    onLoadError?: (event: { error: Error }) => void;
    onConfirm: (event: { expressPaymentType: "apple_pay"; paymentFailed: ReturnType<typeof vi.fn> }) => void;
  }) => {
    return <><button type="button" data-testid="apple-pay-button" onClick={() => props.onConfirm({ expressPaymentType: "apple_pay", paymentFailed: vi.fn() })}>Buy with Apple Pay</button><button type="button" data-testid="apple-pay-ready-available" onClick={() => props.onReady?.({ availablePaymentMethods: { applePay: true } })}>Mark wallet ready</button><button type="button" data-testid="apple-pay-ready-none" onClick={() => props.onReady?.({})}>Mark wallet unavailable</button><button type="button" data-testid="apple-pay-available" onClick={() => props.onAvailablePaymentMethodsChange?.({ paymentMethods: { applePay: { available: true } } })}>Mark wallet available</button><button type="button" data-testid="apple-pay-load-error" onClick={() => props.onLoadError?.({ error: new Error("wallet unavailable") })}>Trigger load error</button></>;
  },
}));

const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

describe("ApplePayCheckout", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_doodle");
    stripe.confirm.mockReset();
  });

  it("creates a session and completes through Checkout confirmation", async () => {
    stripe.confirm.mockResolvedValue({ type: "success", session: { id: "cs_direct" } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    const onComplete = vi.fn();
    const onBusyChange = vi.fn();
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={onComplete} onError={vi.fn()} onBusyChange={onBusyChange} />);

    const button = await screen.findByTestId("apple-pay-button");
    expect(button.parentElement).toHaveAttribute("data-wallet-state", "pending");
    expect(button.parentElement).not.toHaveAttribute("hidden");
    fireEvent.click(screen.getByTestId("apple-pay-available"));
    await waitFor(() => expect(button.parentElement).toHaveAttribute("data-wallet-state", "available"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/checkout/elements", expect.objectContaining({ method: "POST" })));
    fireEvent.click(button);

    await waitFor(() => expect(stripe.confirm).toHaveBeenCalledWith(expect.objectContaining({
      redirect: "if_required",
      expressCheckoutConfirmEvent: expect.objectContaining({ expressPaymentType: "apple_pay" }),
    })));
    expect(onComplete).toHaveBeenCalledWith("cs_direct");
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("reports an immediate Stripe confirmation error to the wallet and caller", async () => {
    stripe.confirm.mockResolvedValue({ type: "error", error: { message: "Payment failed" } });
    const onError = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={onError} onBusyChange={vi.fn()} />);

    const button = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-available"));
    fireEvent.click(button);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Payment failed"));
    expect(stripe.confirm).toHaveBeenCalled();
  });

  it("shows Apple Pay when the ready event reports it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={vi.fn()} onBusyChange={vi.fn()} />);

    const button = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-ready-available"));

    expect(button.parentElement).toHaveAttribute("data-wallet-state", "available");
  });

  it("collapses an empty ready event and can reveal Apple Pay on a later change", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={vi.fn()} onBusyChange={vi.fn()} />);

    const button = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-ready-none"));
    expect(button.parentElement).toHaveAttribute("data-wallet-state", "unavailable");

    fireEvent.click(screen.getByTestId("apple-pay-available"));
    await waitFor(() => expect(button.parentElement).toHaveAttribute("data-wallet-state", "available"));
  });

  it("keeps the hosted fallback clean when the wallet session cannot initialize", async () => {
    const onError = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: "billing_unavailable" }, { status: 503 }));
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={onError} onBusyChange={vi.fn()} />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/checkout/elements", expect.objectContaining({ method: "POST" })));
    expect(onError).not.toHaveBeenCalled();
    expect(screen.queryByTestId("apple-pay-button")).not.toBeInTheDocument();
  });

  it("hides wallet load failures without surfacing a false checkout error", async () => {
    const onError = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={onError} onBusyChange={vi.fn()} />);

    await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-load-error"));

    expect(screen.getByTestId("apple-pay-load-error").parentElement).toHaveAttribute("data-wallet-state", "unavailable");
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports the sanitized Stripe lifecycle and wallet availability events", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    render(<ApplePayCheckout locale="en" ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={vi.fn()} onBusyChange={vi.fn()} />);

    const button = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-ready-none"));
    fireEvent.click(screen.getByTestId("apple-pay-available"));

    await waitFor(() => {
      const diagnosticBodies = fetchMock.mock.calls
        .filter(([url]) => url === "/api/checkout/diagnostic")
        .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as unknown);
      expect(diagnosticBodies).toEqual(expect.arrayContaining([
        { stage: "stripe_init", outcome: "success", reason: "loaded" },
        { stage: "provider", outcome: "success", reason: "ready" },
        { stage: "session_init", outcome: "success", status: "ok" },
        { stage: "express_ready", applePay: "missing" },
        { stage: "availability_change", applePay: "available" },
      ]));
    });
    expect(button.parentElement).toHaveAttribute("data-wallet-state", "available");
  });
});
