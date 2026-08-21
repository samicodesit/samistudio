import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSummary } from "@/app/api/account/route";
import { getCopy } from "@/lib/i18n";
import { PurchaseDialog } from "./purchase-dialog";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ auth }),
}));

const anonymousAccount: AccountSummary = {
  authenticated: false,
  email: null,
  balance: 0,
  freeRemaining: 0,
};
const authenticatedAccount: AccountSummary = {
  authenticated: true,
  email: "buyer@example.com",
  balance: 0,
  freeRemaining: null,
};
const copy = getCopy("en");

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function renderDialog(account: AccountSummary = anonymousAccount) {
  const onClose = vi.fn();
  const onAccountChange = vi.fn();
  render(
    <PurchaseDialog
      open
      account={account}
      scene="A cat"
      locale="en"
      copy={copy}
      success={false}
      onClose={onClose}
      onAccountChange={onAccountChange}
    />,
  );
  return { onClose, onAccountChange };
}

describe("PurchaseDialog", () => {
  beforeEach(() => {
    Object.values(auth).forEach((mock) => mock.mockReset());
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
    sessionStorage.clear();
    vi.stubGlobal("location", {
      origin: "https://doodle.test",
      assign: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows one honest offer and no subscription pricing patterns", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Keep doodling" })).toBeVisible();
    expect(screen.getByText("10 more doodles")).toBeVisible();
    expect(screen.getByText("€4.99")).toBeVisible();
    expect(screen.getByText("One payment. No subscription.")).toBeVisible();
    expect(screen.getByText("Failed generations don't count.")).toBeVisible();
    expect(screen.queryByText(/discount|most popular|per month/i)).not.toBeInTheDocument();
  });

  it("shows Google but hides email OTP by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_OTP_ENABLED", undefined);
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue with email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apple/ })).not.toBeInTheDocument();
  });

  it("shows email OTP when explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_OTP_ENABLED", "true");
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeVisible();
  });

  it("saves the scene before starting Google OAuth", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(JSON.parse(sessionStorage.getItem("doodle:return") ?? "null")).toEqual({
      scene: "A cat",
      intent: "auth",
    });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://doodle.test/auth/callback?locale=en" },
    });
  });

  it("sends and verifies a six-digit email code", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_OTP_ENABLED", "true");
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(authenticatedAccount));
    const { onAccountChange } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Continue with email" }));
    const emailInput = screen.getByLabelText("Email address");
    await waitFor(() => expect(emailInput).toHaveFocus());
    await user.type(emailInput, "buyer@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "buyer@example.com",
      options: { shouldCreateUser: true },
    });

    const codeInput = screen.getByLabelText("Six-digit code");
    await waitFor(() => expect(codeInput).toHaveFocus());
    await user.type(codeInput, "123456");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "buyer@example.com",
      token: "123456",
      type: "email",
    });
    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(authenticatedAccount));
    expect(fetchMock).toHaveBeenCalledWith("/api/account", { cache: "no-store" });
    expect(screen.getByRole("button", { name: "Get 10 doodles" })).toBeVisible();
  });

  it("retries account refresh after OTP succeeds without consuming the code again", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_OTP_ENABLED", "true");
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ error: "temporary" }, { status: 503 }))
      .mockResolvedValueOnce(json(authenticatedAccount));
    const { onAccountChange } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with email" }));
    await user.type(screen.getByLabelText("Email address"), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.type(screen.getByLabelText("Six-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in could not finish");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Enter the six-digit code");
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(authenticatedAccount));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Get 10 doodles" })).toBeVisible();
  });

  it.each([
    ["Arabic-Indic", "١٢٣٤٥٦"],
    ["Persian", "۱۲۳۴۵۶"],
  ])("normalizes %s OTP digits before verification", async (_label, localizedCode) => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_OTP_ENABLED", "true");
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(authenticatedAccount));
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with email" }));
    await user.type(screen.getByLabelText("Email address"), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.type(screen.getByLabelText("Six-digit code"), localizedCode);
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "buyer@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("saves the scene and redirects an authenticated buyer to Stripe", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ url: "https://checkout.stripe.com/test" }));
    renderDialog(authenticatedAccount);

    await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));

    expect(JSON.parse(sessionStorage.getItem("doodle:return") ?? "null")).toEqual({
      scene: "A cat",
      intent: "checkout",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en" }),
    });
    expect(location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/test");
  });

  it("closes through native cancel and backdrop behavior", () => {
    const { onClose } = renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Keep doodling" });

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
