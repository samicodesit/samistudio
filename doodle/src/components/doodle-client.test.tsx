import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCopy, type Locale } from "@/lib/i18n";
import { DoodleClient } from "./doodle-client";

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ auth }),
}));

function renderClient(locale: Locale = "en") {
  return render(<DoodleClient locale={locale} copy={getCopy(locale)} />);
}

const anonymousAccount = {
  authenticated: false,
  email: null,
  balance: 0,
  freeRemaining: 2,
};

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function mockGeneration(response: Response) {
  vi.mocked(fetch).mockImplementation(async (input) =>
    input === "/api/account" ? json(anonymousAccount) : response,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("DoodleClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:one");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (input === "/api/account") return json(anonymousAccount);
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    auth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
    sessionStorage.clear();
    history.replaceState({}, "", "/");
  });

  it("fills a suggestion without generating", () => {
    const fetchMock = vi.mocked(fetch);
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /warm scarf/ }));
    expect(screen.getByRole("textbox")).toHaveValue("A person giving someone a warm scarf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/account", { cache: "no-store" });
  });

  it("keeps the visual surface focused and the suggestions keyboard accessible", () => {
    renderClient();
    expect(screen.getByAltText(/two cats kissing upside down/)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "What should we doodle?" })).toBeInTheDocument();
    expect(screen.queryByText(/One tiny moment|Private space|private little space|Your prompts/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /warm scarf/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Create doodle/ })).toBeVisible();
  });

  it("renders localized controls and suggestions", () => {
    renderClient("de");

    expect(screen.getByRole("heading", { name: "Was sollen wir zeichnen?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Doodle erstellen" })).toBeVisible();
    expect(screen.getByRole("button", { name: /warmen Schal/ })).toBeVisible();
  });

  it("opens the reference doodle for a closer look", () => {
    renderClient();

    fireEvent.click(screen.getByRole("button", { name: "View example doodle larger" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("img", { name: "Sticky-note doodle" })).toBeVisible();
  });

  it("moves from idle to generating to ready", async () => {
    mockGeneration(new Response(new Blob(["png"]), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Drawing your doodle...");
    await waitFor(() => expect(screen.getByAltText("Generated sticky-note doodle")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("download", "doodle.png");
    expect(screen.getByRole("button", { name: /View larger/ })).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /New scene/ })).toBeVisible();
  });

  it("preserves the scene when generation fails", async () => {
    mockGeneration(new Response(null, { status: 504 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A scene that takes time" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("took too long");
    expect(screen.getByRole("textbox")).toHaveValue("A scene that takes time");
  });

  it("shows a localized daily-limit message", async () => {
    mockGeneration(new Response(null, { status: 429 }));
    renderClient("ar");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "قطة تحمل مظلة" } });
    fireEvent.click(screen.getByRole("button", { name: "أنشئ رسمة" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("أنشأت رسومات كثيرة اليوم");
    expect(screen.getByRole("textbox")).toHaveValue("قطة تحمل مظلة");
  });

  it("keeps the public composer visible when generation is unavailable", async () => {
    mockGeneration(new Response(null, { status: 401 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this scene" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getByRole("textbox")).toHaveValue("Keep this scene");
    expect(screen.queryByLabelText("Passphrase")).not.toBeInTheDocument();
  });

  it("starts a new blank scene after a result", async () => {
    mockGeneration(new Response(new Blob(["png"]), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A finished scene" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    await screen.findByAltText("Generated sticky-note doodle");
    fireEvent.click(screen.getByRole("button", { name: /New scene/ }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByAltText(/two cats kissing upside down/)).toBeInTheDocument();
  });

  it("opens purchase without losing the scene on payment_required", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(anonymousAccount))
      .mockResolvedValueOnce(
        json(
          { error: "payment_required" },
          { status: 402, headers: { "X-Doodle-Free-Remaining": "0", "Content-Type": "application/json" } },
        ),
      );
    renderClient();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this exact scene" } });
    const createButton = screen.getByRole("button", { name: "Create doodle" });
    createButton.focus();
    fireEvent.click(createButton);

    const dialog = await screen.findByRole("dialog", { name: "Keep doodling" });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("Keep this exact scene");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Create doodle" })).toHaveFocus();
  });

  it("updates remaining usage from generation headers", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(anonymousAccount))
      .mockResolvedValueOnce(
        new Response(new Blob(["png"]), {
          status: 200,
          headers: { "X-Doodle-Free-Remaining": "1" },
        }),
      );
    renderClient();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));

    expect(await screen.findByText("1 free doodle left")).toBeVisible();
  });

  it("refreshes uncertain balance without delaying or losing the generated image", async () => {
    const initialAccount = deferred<Response>();
    let accountRequests = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") {
        accountRequests += 1;
        return accountRequests === 1
          ? initialAccount.promise
          : json({ ...anonymousAccount, freeRemaining: 1 });
      }
      if (input === "/api/generate") {
        return new Response(new Blob(["png"]), {
          status: 200,
          headers: { "X-Doodle-Balance-Uncertain": "1" },
        });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    renderClient();
    await waitFor(() => expect(accountRequests).toBe(1));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));

    expect(await screen.findByAltText("Generated sticky-note doodle")).toBeVisible();
    expect(await screen.findByText("1 free doodle left")).toBeVisible();
    await act(async () => initialAccount.resolve(json(anonymousAccount)));
    expect(screen.getByText("1 free doodle left")).toBeVisible();
  });

  it("keeps the uncertain image and current balance when account refresh fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(anonymousAccount))
      .mockResolvedValueOnce(
        new Response(new Blob(["png"]), {
          status: 200,
          headers: { "X-Doodle-Balance-Uncertain": "1" },
        }),
      )
      .mockRejectedValueOnce(new Error("offline"));
    renderClient();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));

    expect(await screen.findByAltText("Generated sticky-note doodle")).toBeVisible();
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/account")).toHaveLength(2));
    expect(screen.getByText("First 2 doodles free")).toBeVisible();
  });

  it("adopts delayed authenticated identity without replacing a newer paid balance header", async () => {
    const initialAccount = deferred<Response>();
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") return initialAccount.promise;
      if (input === "/api/generate") {
        return new Response(new Blob(["png"]), {
          status: 200,
          headers: { "X-Doodle-Paid-Remaining": "7" },
        });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    renderClient();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/account", { cache: "no-store" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A paid doodle" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await screen.findByAltText("Generated sticky-note doodle");

    await act(async () => initialAccount.resolve(json({
      authenticated: true,
      email: "buyer@example.com",
      balance: 2,
      freeRemaining: null,
    })));

    expect(screen.getByText("7 doodles left", { selector: ".workspace-usage > span" })).toBeVisible();
    fireEvent.click(screen.getByText("Account"));
    expect(screen.getByText("buyer@example.com")).toBeVisible();
    expect(screen.getAllByText("7 doodles left")).toHaveLength(2);
  });

  it("shows a zero paid balance instead of anonymous trial copy when signed in", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }),
    );

    renderClient();

    await waitFor(() => expect(screen.getByText("0 doodles left", { selector: ".usage-copy" })).toBeVisible());
    expect(screen.queryByText("First 2 doodles free")).not.toBeInTheDocument();
  });

  it("ignores a delayed anonymous account response after OTP refresh authenticates the user", async () => {
    const user = userEvent.setup();
    const initialAccount = deferred<Response>();
    const authenticatedAccount = {
      authenticated: true,
      email: "buyer@example.com",
      balance: 0,
      freeRemaining: null,
    };
    let accountRequests = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") {
        accountRequests += 1;
        return accountRequests === 1 ? initialAccount.promise : json(authenticatedAccount);
      }
      if (input === "/api/generate") {
        return json({ error: "payment_required" }, { status: 402 });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    renderClient();
    await waitFor(() => expect(accountRequests).toBe(1));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A cat" } });
    await user.click(screen.getByRole("button", { name: "Create doodle" }));
    await user.click(await screen.findByRole("button", { name: "Get 10 doodles" }));
    await user.click(screen.getByRole("button", { name: "Continue with email" }));
    await user.type(screen.getByLabelText("Email address"), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.type(screen.getByLabelText("Six-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(accountRequests).toBe(2));
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("0 doodles left", { selector: ".usage-copy" })).toBeVisible());
    await act(async () => initialAccount.resolve(json(anonymousAccount)));

    expect(screen.getByText("0 doodles left", { selector: ".usage-copy" })).toBeVisible();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.queryByText("First 2 doodles free")).not.toBeInTheDocument();
  });

  it("restores the exact scene and offer after OAuth returns", async () => {
    history.replaceState({}, "", "/?auth=success");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat & a moon", intent: "auth" }));
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }),
    );

    renderClient();

    expect(await screen.findByRole("dialog", { name: "Keep doodling" })).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("A cat & a moon");
  });

  it("restores the exact scene after Checkout is cancelled", async () => {
    history.replaceState({}, "", "/?checkout=cancelled");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat + a kite", intent: "checkout" }));

    renderClient();

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("A cat + a kite"));
    expect(screen.queryByRole("dialog", { name: "Keep doodling" })).not.toBeInTheDocument();
  });

  it("confirms a returned Checkout session once before showing success", async () => {
    history.replaceState({}, "", "/?checkout=cs_paid");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat", intent: "checkout" }));
    const authenticatedAccount = {
      authenticated: true,
      email: "buyer@example.com",
      balance: 0,
      freeRemaining: null,
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(authenticatedAccount))
      .mockResolvedValueOnce(json({ balance: 10 }));

    renderClient();

    expect(await screen.findByText("10 doodles added")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("A cat");
    const confirmationCalls = vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/checkout/confirm");
    expect(confirmationCalls).toEqual([
      [
        "/api/checkout/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: "cs_paid" }),
        },
      ],
    ]);
    expect(sessionStorage.getItem("doodle:return")).toBeNull();
    expect(location.search).toBe("");
  });

  it("retries a failed returned Checkout confirmation without starting another Checkout", async () => {
    history.replaceState({}, "", "/?checkout=cs_retry");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat", intent: "checkout" }));
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }))
      .mockResolvedValueOnce(json({ error: "temporary" }, { status: 503 }))
      .mockResolvedValueOnce(json({ balance: 10 }));

    renderClient();

    expect(await screen.findByRole("alert")).toHaveTextContent("Checkout could not start");
    expect(sessionStorage.getItem("doodle:return")).not.toBeNull();
    expect(location.search).toBe("?checkout=cs_retry");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("10 doodles added")).toBeVisible();
    const confirmationCalls = vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/checkout/confirm");
    expect(confirmationCalls).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls.some(([input]) => input === "/api/checkout")).toBe(false);
    expect(sessionStorage.getItem("doodle:return")).toBeNull();
    expect(location.search).toBe("");
  });
});
