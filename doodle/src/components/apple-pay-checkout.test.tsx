import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplePayCheckout } from "./apple-pay-checkout";

const stripe = vi.hoisted(() => ({
  confirm: vi.fn(),
  session: { currency: "usd", currencyOptions: [{ currency: "usd" }, { currency: "eur" }], canConfirm: true, tax: { status: "ready" as "ready" | "requires_billing_address" }, total: { total: { amount: "$5.76" } } },
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children, options }: { children: React.ReactNode; options: { adaptivePricing?: { allowed?: boolean } } }) => <div data-testid="checkout-provider" data-adaptive-pricing={String(options.adaptivePricing?.allowed ?? false)}>{children}</div>,
  useCheckoutElements: () => ({ type: "success", checkout: { ...stripe.session, confirm: stripe.confirm } }),
  CurrencySelectorElement: ({ onReady, onLoadError }: { onReady?: () => void; onLoadError?: () => void }) => <div data-testid="currency-selector"><button onClick={onReady}>Currency selector ready</button><button onClick={onLoadError}>Currency selector failed</button></div>,
  ExpressCheckoutElement: (props: {
    options: { layout: { maxRows: number; overflow: string } };
    className?: string;
    onReady?: (event: { availablePaymentMethods?: { applePay: boolean } }) => void;
    onAvailablePaymentMethodsChange?: (event: { paymentMethods: { applePay: { available: boolean } } }) => void;
    onLoadError?: (event: { error: Error }) => void;
    onConfirm: (event: { expressPaymentType: "apple_pay"; billingDetails: { name: string; email: string; address: { country: string } }; paymentFailed: ReturnType<typeof vi.fn> }) => void;
  }) => {
    if (props.options.layout.overflow === "never" && props.options.layout.maxRows > 0) {
      throw new Error("Stripe rejects overflow never with a bounded maxRows");
    }
    return <><button type="button" className={props.className} data-testid="apple-pay-button" onClick={() => props.onConfirm({ expressPaymentType: "apple_pay", billingDetails: { name: "Wallet buyer", email: "wallet@example.com", address: { country: "NL" } }, paymentFailed: vi.fn() })}>Buy with Apple Pay</button><button type="button" data-testid="apple-pay-ready-available" onClick={() => props.onReady?.({ availablePaymentMethods: { applePay: true } })}>Mark wallet ready</button><button type="button" data-testid="apple-pay-ready-none" onClick={() => props.onReady?.({})}>Mark wallet unavailable</button><button type="button" data-testid="apple-pay-available" onClick={() => props.onAvailablePaymentMethodsChange?.({ paymentMethods: { applePay: { available: true } } })}>Mark wallet available</button><button type="button" data-testid="apple-pay-load-error" onClick={() => props.onLoadError?.({ error: new Error("wallet unavailable") })}>Trigger load error</button></>;
  },
}));

const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

describe("ApplePayCheckout", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_doodle");
    stripe.confirm.mockReset();
    stripe.session = { currency: "usd", currencyOptions: [{ currency: "usd" }, { currency: "eur" }], canConfirm: true, tax: { status: "ready" }, total: { total: { amount: "$5.76" } } };
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
      expressCheckoutConfirmEvent: expect.objectContaining({ expressPaymentType: "apple_pay", billingDetails: expect.objectContaining({ address: { country: "NL" } }) }),
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
  it("uses the selected pack and preserves the drawing before confirming",async()=>{
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(json({clientSecret:"cs_secret"}));const before=vi.fn().mockResolvedValue(undefined);
    render(<ApplePayCheckout locale="en" productId="pack_big" expectedCredits={60} ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onBeforeConfirm={before} onComplete={vi.fn()} onError={vi.fn()} onBusyChange={vi.fn()}/>);
    const button=await screen.findByTestId("apple-pay-button");expect(fetchMock).toHaveBeenCalledWith("/api/checkout/elements",expect.objectContaining({body:JSON.stringify({locale:"en",productId:"pack_big",expectedCredits:60})}));fireEvent.click(screen.getByTestId("apple-pay-available"));fireEvent.click(screen.getByRole("button", { name: "Currency selector ready" }));fireEvent.click(button);await waitFor(()=>expect(stripe.confirm).toHaveBeenCalled());expect(before).toHaveBeenCalledOnce();expect(before.mock.invocationCallOrder[0]).toBeLessThan(stripe.confirm.mock.invocationCallOrder[0]);
  });

  it("shows the exact selected-currency total above Apple Pay and enables Adaptive Pricing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    const props = { locale: "en" as const, productId: "pack_regular", expectedCredits: 25, ariaLabel: "Pay with Apple Pay", unavailableMessage: "Checkout unavailable", onComplete: vi.fn(), onError: vi.fn(), onBusyChange: vi.fn() };
    const view = render(<ApplePayCheckout {...props} />);
    const wallet = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-ready-available"));
    fireEvent.click(screen.getByRole("button", { name: "Currency selector ready" }));
    const selector = screen.getByTestId("currency-selector");
    expect(screen.getByTestId("checkout-provider")).toHaveAttribute("data-adaptive-pricing", "true");
    expect(screen.getByText(/\$5\.76/)).toHaveTextContent("USD");
    expect(selector.compareDocumentPosition(wallet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    stripe.session = { ...stripe.session, currency: "eur", total: { total: { amount: "€4.99" } } };
    view.rerender(<ApplePayCheckout {...props} />);
    expect(screen.getByText(/€4\.99/)).toHaveTextContent("EUR");
    expect(screen.queryByText(/\$5\.76/)).toBeNull();
  });

  it("never confirms an adaptive wallet payment before currency choice is ready or after it fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    const onError = vi.fn();
    render(<ApplePayCheckout locale="en" productId="pack_regular" expectedCredits={25} ariaLabel="Pay with Apple Pay" unavailableMessage="Checkout unavailable" onComplete={vi.fn()} onError={onError} onBusyChange={vi.fn()} />);
    const wallet = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-ready-available"));
    fireEvent.click(wallet);
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Checkout unavailable"));
    expect(stripe.confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Currency selector failed" }));
    fireEvent.click(wallet);
    expect(stripe.confirm).not.toHaveBeenCalled();
  });

  it("keeps the express wallet usable when required billing details have not been collected yet", async () => {
    stripe.session = { ...stripe.session, canConfirm: false, tax: { status: "requires_billing_address" } };
    stripe.confirm.mockResolvedValue({ type: "success", session: { id: "cs_wallet_billing" } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ clientSecret: "cs_secret" }));
    const props = { locale: "en" as const, productId: "pack_regular", expectedCredits: 25, ariaLabel: "Pay with Apple Pay", unavailableMessage: "Checkout unavailable", onComplete: vi.fn(), onError: vi.fn(), onBusyChange: vi.fn() };
    render(<ApplePayCheckout {...props} />);
    const wallet = await screen.findByTestId("apple-pay-button");
    fireEvent.click(screen.getByTestId("apple-pay-ready-available"));
    fireEvent.click(screen.getByRole("button", { name: "Currency selector ready" }));
    expect(wallet).not.toHaveClass("purchase-wallet-hidden");
    fireEvent.click(wallet);
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledWith("cs_wallet_billing"));
    expect(stripe.confirm).toHaveBeenCalledWith(expect.objectContaining({
      expressCheckoutConfirmEvent: expect.objectContaining({ expressPaymentType: "apple_pay" }),
    }));
  });

});
