import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCopy, type Locale } from "@/lib/i18n";
import { DoodleClient } from "./doodle-client";
import { getLandingCopy } from "@/lib/landing-copy";

const mocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@vercel/analytics", () => ({ track: mocks.track }));
vi.mock("./google-sign-in-button", () => ({
  GoogleSignInButton: ({ onCredential }: { onCredential(token: string): void }) => <button type="button" onClick={() => onCredential("google-token")}>Continue with Google</button>,
  isIosBrowser: () => false,
}));

function renderClient(locale: Locale = "en", initialScene = "", landing = false) {
  const host = document.createElement("div");
  host.dataset.accountHost = "web";
  document.body.append(host);
  return render(<DoodleClient webPacksEnabled locale={locale} copy={getCopy(locale)} initialScene={initialScene} accountHost="web" landing={landing ? getLandingCopy(locale) : undefined} />);
}

async function expectAccountBalance(label: string) {
  await waitFor(() => expect(document.querySelector(".account-menu") || screen.queryByRole("button", { name: "Sign in" })).toBeTruthy());
  const summary = document.querySelector<HTMLDetailsElement>(".account-menu");
  if (summary) {
    summary.open = true;
    await screen.findByText(label.replace(" free", ""), { selector: ".account-balance" });
    expect(screen.getByText(label.replace(" free", ""), { selector: ".account-balance" })).toBeVisible();
    summary.open = false;
  } else {
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(label, { selector: ".account-usage" })).toBeVisible();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  }
  expect(document.querySelector(".composer-usage, .workspace-usage")).toBeNull();
}

function suggestionLabels() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".suggestions-list button"), (button) =>
    button.textContent?.replace("+", "").trim() ?? "",
  );
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
  it("keeps landing ideas refreshable without spending credits or replacing the selected detail or draft", async () => {
    renderClient("en", "A cat holding a flower", true);
    await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(screen.getByRole("button", { name: /^Detail:/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    const previous = suggestionLabels();
    expect(previous).toHaveLength(3);
    const calls = vi.mocked(fetch).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh ideas" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh ideas" })).toBeEnabled());
    expect(suggestionLabels().every(idea => !previous.includes(idea))).toBe(true);
    expect(screen.getByRole("textbox")).toHaveValue("A cat holding a flower");
    await waitFor(() => expect(screen.getByRole("button", { name: "Detail: Medium" })).toHaveAttribute("aria-expanded", "false"));
    expect(fetch).toHaveBeenCalledTimes(calls);
  });

  it("refreshes three ideas without changing the draft or calling generation", async () => {
    renderClient("en", "A mug beside my journal");
    await screen.findByRole("button", { name: "Sign in" });
    const previous = suggestionLabels();
    const calls = vi.mocked(fetch).mock.calls.length;
    const refresh = screen.getByRole("button", { name: "Refresh ideas" });

    fireEvent.click(refresh);

    expect(refresh).toBeDisabled();
    expect(document.querySelector(".suggestions-list")).toHaveAttribute("data-refresh-phase", "entering");
    const entering = suggestionLabels();
    expect(entering.every((idea) => !previous.includes(idea))).toBe(true);
    fireEvent.click(refresh);
    expect(suggestionLabels()).toEqual(entering);
    await waitFor(() => expect(refresh).toBeEnabled());

    const next = suggestionLabels();
    expect(next).toHaveLength(3);
    expect(new Set(next).size).toBe(3);
    expect(next.every((idea) => !previous.includes(idea))).toBe(true);
    expect(screen.getByRole("textbox")).toHaveValue("A mug beside my journal");
    expect(fetch).toHaveBeenCalledTimes(calls);
    expect(refresh).toHaveAttribute("title", "Refresh ideas");
  });

  it("refreshes Arabic ideas with a localized accessible button", async () => {
    renderClient("ar", "مشهد صغير");
    const previous = suggestionLabels();
    fireEvent.click(screen.getByRole("button", { name: "تحديث الأفكار" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "تحديث الأفكار" })).toBeEnabled());
    const next = suggestionLabels();
    expect(next.every((idea) => getCopy("ar").suggestions.items.includes(idea))).toBe(true);
    expect(next.every((idea) => !previous.includes(idea))).toBe(true);
    expect(screen.getByRole("textbox")).toHaveValue("مشهد صغير");
  });

  it("refreshes immediately without motion when reduced motion is enabled", () => {
    const originalMatchMedia = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ ...originalMatchMedia(query), matches: query.includes("prefers-reduced-motion") }));
    renderClient();
    const previous = suggestionLabels();
    const refresh = screen.getByRole("button", { name: "Refresh ideas" });
    fireEvent.click(refresh);
    expect(refresh).toBeEnabled();
    expect(suggestionLabels().every((idea) => !previous.includes(idea))).toBe(true);
    expect(document.querySelector(".suggestions-list")).toHaveAttribute("data-refresh-phase", "idle");
  });

  it("lets a landing-page visitor choose an editable occasion without generating", async () => {
    renderClient("en", "", true);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your words.A little drawing.");
    const create = screen.getByRole("button", { name: "Create doodle" });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Birthday card" }));
    expect(screen.getByRole("textbox")).toHaveValue("A happy dog holding a birthday balloon");
    expect(create).toBeEnabled();
    await screen.findByRole("button", { name: "Sign in" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Example drawing:/ })).toBeVisible();
  });

  it("replaces the labelled landing example with the real generated result", async () => {
    mockGeneration(new Response(new Blob(["image"], { type: "image/png" }), { status: 200 }));
    renderClient("en", "A small scene", true);
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await screen.findByRole("button", { name: getCopy("en").stage.viewLarger });
    expect(screen.queryByText("Example drawing")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your words/ })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: getCopy("en").stage.generatedAlt })).toHaveAttribute("src", "blob:one");
  });

  it("keeps the landing prompt editable after a generation error", async () => {
    mockGeneration(new Response(null, { status: 503 }));
    renderClient("en", "A small scene", true);
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox")).toHaveValue("A small scene");
    expect(screen.getByRole("button", { name: "Create doodle" })).toBeEnabled();
    expect(screen.queryByText("Example drawing")).not.toBeInTheDocument();
  });
  afterEach(() => {
    document.querySelectorAll("[data-account-host]").forEach((host) => host.remove());
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.track.mockReset();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:one");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (input === "/api/account") return json(anonymousAccount);
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    sessionStorage.clear();
    const preferences = new Map<string, string>();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => preferences.get(key) ?? null,
      setItem: (key: string, value: string) => preferences.set(key, value),
      removeItem: (key: string) => preferences.delete(key),
      clear: () => preferences.clear(),
    } });
    history.replaceState({}, "", "/");
  });

  it("fills a suggestion without generating", () => {
    const fetchMock = vi.mocked(fetch);
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /warm scarf/ }));
    expect(screen.getByRole("textbox")).toHaveValue("A person giving someone a warm scarf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/account", { cache: "no-store", headers: { "x-doodle-packs": "v1" } });
  });

  it("keeps the same idea cards while the scene is edited", () => {
    renderClient();
    const initial = suggestionLabels();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A little scene" } });

    expect(suggestionLabels()).toEqual(initial);
    expect(initial).toHaveLength(3);
  });

  it("lets a signed-in customer refill before spending existing credits", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") return json({ authenticated: true, email: "buyer@example.com", balance: 7, freeRemaining: null });
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderClient();
    await user.click(await screen.findByText("Account"));
    await user.click(screen.getByRole("button", { name: "Get more" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("buyer@example.com")).not.toBeVisible();
    expect(fetch).toHaveBeenCalledWith("/api/account", { cache: "no-store", headers: { "x-doodle-packs": "v1" } });
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/account")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await expectAccountBalance("7 doodles left");
    expect(screen.getByText("Account").closest("summary")).toHaveFocus();
  });

  it("returns focus to Create after a refill is cancelled and the next generation needs payment", async () => {
    const user = userEvent.setup();
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") return json({ authenticated: true, email: "buyer@example.com", balance: 7, freeRemaining: null });
      if (input === "/api/generate") return json({ error: "payment_required" }, { status: 402 });
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    renderClient();

    await user.click(await screen.findByText("Account"));
    await user.click(screen.getByRole("button", { name: "Get more" }));
    await user.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.getByText("Account").closest("summary")).toHaveFocus());

    const createButton = screen.getByRole("button", { name: "Create doodle" });
    await user.type(screen.getByRole("textbox"), "A small paid scene");
    createButton.focus();
    await user.click(createButton);
    const dialog = await screen.findByRole("dialog", { name: "Keep doodling" });
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Create doodle" })).toHaveFocus();
  });

  it("prefills an idea without generating", () => {
    const fetchMock = vi.mocked(fetch);
    renderClient("en", "A dog holding one birthday balloon");

    expect(screen.getByRole("textbox")).toHaveValue("A dog holding one birthday balloon");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/account", { cache: "no-store", headers: { "x-doodle-packs": "v1" } });
  });

  it("does not flash anonymous allowance while the account is loading", async () => {
    const initialAccount = deferred<Response>();
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") return initialAccount.promise;
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    renderClient();

    expect(screen.queryByText("Free doodles to get started")).not.toBeInTheDocument();
    expect(document.querySelector(".composer-usage")).toBeNull();

    await act(async () => initialAccount.resolve(json(anonymousAccount)));
    await expectAccountBalance("2 free doodles left");
  });

  it("shows unavailable balance in the guest account panel when the account read fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));renderClient();
    fireEvent.click(await screen.findByRole("button",{name:"Sign in"}));
    expect(await screen.findByText(getCopy("en").errors.unavailable,{selector:".account-usage"})).toBeVisible();
    expect(screen.queryByText("0 doodles left")).toBeNull();
  });

  it("keeps sign-in visible beside the allowance and opens a neutral sign-in dialog", async () => {
    const user = userEvent.setup();
    renderClient();

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    const dialog = screen.getByRole("dialog", { name: "Sign in" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(within(dialog).queryByText("Keep doodling")).not.toBeInTheDocument();
  });

  it("returns focus to the new account control after sign-in replaces the trigger", async () => {
    const user = userEvent.setup();
    let signedIn = false;
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") return json(signedIn ? { authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null } : anonymousAccount);
      if (input === "/api/auth/google") {
        signedIn = true;
        return new Response(null, { status: 204 });
      }
      if (input === "/api/generate") return new Response(new Blob(["png"]), { status: 200 });
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    renderClient();

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "A finished scene" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await screen.findByAltText("Generated sticky-note doodle");

    const signIn = screen.getByRole("button", { name: "Sign in" });
    signIn.focus();
    await user.click(signIn);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const accountControl = screen.getByText("Account").closest("summary");
    expect(accountControl).not.toBeNull();
    expect(accountControl).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
  });

  it("keeps the visual surface focused and the suggestions keyboard accessible", () => {
    renderClient();
    expect(screen.getByAltText(/two cats kissing upside down/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Let’s doodle." })).toBeInTheDocument();
    expect(screen.queryByText(/One tiny moment|Private space|private little space|Your prompts/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /warm scarf/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Create doodle/ })).toBeVisible();
  });

  it("renders localized controls and suggestions", () => {
    renderClient("de");

    expect(screen.getByRole("heading", { name: "Zeichnen wir." })).toBeVisible();
    expect(screen.getByRole("button", { name: "Doodle erstellen" })).toBeVisible();
    expect(screen.getByRole("button", { name: /warmen Schal/ })).toBeVisible();
  });

  it("opens the reference doodle for a closer look", () => {
    renderClient();

    fireEvent.click(screen.getByRole("button", { name: "View example doodle larger" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("img", { name: getCopy("en").stage.referenceAlt })).toBeVisible();
  });

  it("moves from idle to generating to ready", async () => {
    mockGeneration(new Response(new Blob(["png"]), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Drawing your doodle...");
    expect(screen.queryByText(getCopy("en").status.generatingTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(getCopy("en").status.generatingEyebrow)).not.toBeInTheDocument();
    expect(screen.queryByText(getCopy("en").status.waitHint)).not.toBeInTheDocument();
    expect(screen.queryByText(/“Two cats hug”/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByAltText("Generated sticky-note doodle")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("download", "doodle.png");
    expect(screen.getByRole("button", { name: /View larger/ })).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Redraw this idea/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Draw something else/ })).toBeVisible();
  });

  it("tracks one anonymous event after a doodle is created", async () => {
    mockGeneration(new Response(new Blob(["png"]), { status: 200 }));
    renderClient();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));

    expect(mocks.track).not.toHaveBeenCalled();
    await screen.findByAltText("Generated sticky-note doodle");
    expect(mocks.track).toHaveBeenCalledOnce();
    expect(mocks.track).toHaveBeenCalledWith("Doodle Created");
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

    expect(await screen.findByRole("alert")).toHaveTextContent("تم الوصول إلى حدّ الرسم اليومي. جرّب مرة أخرى غدًا.");
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
    const previousSuggestions = suggestionLabels();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A finished scene" } });
    fireEvent.click(screen.getByRole("button", { name: /Create doodle/ }));
    await screen.findByAltText("Generated sticky-note doodle");
    fireEvent.click(screen.getByRole("button", { name: /Draw something else/ }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/generate")).toHaveLength(1);
    expect(screen.getByAltText(/two cats kissing upside down/)).toBeInTheDocument();
    const nextSuggestions = suggestionLabels();
    expect(nextSuggestions).toHaveLength(3);
    expect(new Set(nextSuggestions).size).toBe(3);
    expect(nextSuggestions.some((suggestion) => previousSuggestions.includes(suggestion))).toBe(false);
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
    // Unconfigured prices may report unavailable, but never a generation error.
    expect(screen.queryByText(getCopy("en").errors.general)).not.toBeInTheDocument();

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Create doodle" })).toHaveFocus();
  });

  it("keeps remaining free drawings visible after sign-in and generation", async () => {
    const signedIn = { authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: 2 };
    vi.mocked(fetch).mockResolvedValueOnce(json(signedIn)).mockResolvedValueOnce(
      new Response(new Blob(["png"]), { status: 200, headers: { "X-Doodle-Free-Remaining": "1" } }),
    );
    renderClient();
    await expectAccountBalance("2 free doodles left");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await expectAccountBalance("1 free doodle left");
  });

  it("shows all available paid and free drawings, then the trial after paid exhaustion", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ authenticated: true, email: "buyer@example.com", balance: 1, freeRemaining: 2 })).mockResolvedValueOnce(
      new Response(new Blob(["png"]), { status: 200, headers: { "X-Doodle-Paid-Remaining": "0" } }),
    );
    renderClient();
    await expectAccountBalance("3 doodles left");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await expectAccountBalance("2 free doodles left");
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

    await expectAccountBalance("1 free doodle left");
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
    await expectAccountBalance("1 free doodle left");
    await act(async () => initialAccount.resolve(json(anonymousAccount)));
    await expectAccountBalance("1 free doodle left");
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
    await expectAccountBalance("2 free doodles left");
  });

  it("only applies the latest overlapping uncertainty reconciliation", async () => {
    const firstRefresh = deferred<Response>();
    const secondRefresh = deferred<Response>();
    let accountRequests = 0;
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === "/api/account") {
        accountRequests += 1;
        if (accountRequests === 1) return json(anonymousAccount);
        return accountRequests === 2 ? firstRefresh.promise : secondRefresh.promise;
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
    await screen.findByRole("button", { name: "Sign in" });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two cats hug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await waitFor(() => expect(accountRequests).toBe(2));
    fireEvent.click(await screen.findByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Redraw this idea" }));
    await waitFor(() => expect(accountRequests).toBe(3));
    expect(screen.getByAltText("Generated sticky-note doodle")).toHaveAttribute("src", "blob:second");

    await act(async () => firstRefresh.resolve(json({ ...anonymousAccount, freeRemaining: 1 })));
    await expectAccountBalance("2 free doodles left");

    await act(async () => secondRefresh.resolve(json({
      authenticated: true,
      email: "buyer@example.com",
      balance: 8,
      freeRemaining: null,
    })));
    await expectAccountBalance("8 doodles left");
    expect(screen.getByText("Account")).toBeVisible();
    expect(screen.getByAltText("Generated sticky-note doodle")).toHaveAttribute("src", "blob:second");
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
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/account", { cache: "no-store", headers: { "x-doodle-packs": "v1" } }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A paid doodle" } });
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await screen.findByAltText("Generated sticky-note doodle");

    await act(async () => initialAccount.resolve(json({
      authenticated: true,
      email: "buyer@example.com",
      balance: 2,
      freeRemaining: null,
    })));

    await expectAccountBalance("7 doodles left");
    fireEvent.click(screen.getByText("Account"));
    expect(screen.getByText("buyer@example.com")).toBeVisible();
    expect(screen.getAllByText("7 doodles left")).toHaveLength(1);
  });

  it("shows a zero paid balance instead of anonymous trial copy when signed in", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }),
    );

    renderClient();

    await expectAccountBalance("0 doodles left");
    expect(screen.queryByText("Free doodles to get started")).not.toBeInTheDocument();
  });

  it("ignores a delayed anonymous account response after Google refresh authenticates the user", async () => {
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
      if (input === "/api/checkout/catalog") return json({offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false,unitAmount:199,currency:"EUR"},{productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true,unitAmount:499,currency:"EUR"},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false,unitAmount:999,currency:"EUR"}]});
      if (input === "/api/auth/google") return new Response(null, { status: 204 });
      if (input === "/api/account") {
        accountRequests += 1;
        return accountRequests === 1 ? initialAccount.promise : json(authenticatedAccount);
      }
      if (input === "/api/generate") {
        return json({ error: "payment_required" }, { status: 402 });
      }
      if (input === "/api/checkout") return json({ error: "unavailable" }, { status: 503 });
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    renderClient();
    await waitFor(() => expect(accountRequests).toBe(1));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A cat" } });
    await user.click(screen.getByRole("button", { name: "Create doodle" }));
    await user.click(await screen.findByRole("button", { name: /Get 25 doodles/ }));
    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(accountRequests).toBe(2));
    await expectAccountBalance("0 doodles left");
    await act(async () => initialAccount.resolve(json(anonymousAccount)));

    await expectAccountBalance("0 doodles left");
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.queryByText("Free doodles to get started")).not.toBeInTheDocument();
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

  it("does not reopen the purchase sheet after account sign-in returns", async () => {
    history.replaceState({}, "", "/?auth=success");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat", intent: "account", path: "/" }));
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }),
    );

    renderClient();

    expect(await screen.findByText("Account")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("doodle:return")).toBeNull();
    expect(location.search).toBe("");
  });

  it("reopens the account sign-in sheet when redirect auth fails", async () => {
    history.replaceState({}, "", "/?auth=error");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat", intent: "account", path: "/" }));

    renderClient();

    expect(await screen.findByRole("dialog", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(getCopy("en").auth.authError);
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

    expect(await screen.findByText("Added 10 doodles")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("A cat");
    const confirmationCalls = vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/checkout/confirm");
    expect(confirmationCalls).toEqual([
      [
        "/api/checkout/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-doodle-packs": "v1" },
          body: JSON.stringify({ sessionId: "cs_paid" }),
          signal: expect.any(AbortSignal),
        },
      ],
    ]);
    expect(sessionStorage.getItem("doodle:return")).toBeNull();
    expect(location.search).toBe("");
  });

  it("recovers a temporary confirmation failure without another checkout or an error-looking payment state", async () => {
    history.replaceState({}, "", "/?checkout=cs_retry");
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat", intent: "checkout" }));
    let confirmations=0;
    vi.mocked(fetch).mockImplementation(async input => input==="/api/account" ? json({authenticated:true,email:"buyer@example.com",balance:0,freeRemaining:null}) : input==="/api/checkout/catalog" ? json({offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false,unitAmount:199,currency:"EUR"},{productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true,unitAmount:499,currency:"EUR"},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false,unitAmount:999,currency:"EUR"}]}) : input==="/api/checkout/confirm" ? ++confirmations===1 ? json({error:"temporary"},{status:503}) : json({balance:10,creditsGranted:10}) : new Response(null,{status:503}));

    vi.useFakeTimers();
    try {
    await act(async () => { renderClient(); });

    expect(screen.getByRole("button", { name: "Payment processing" })).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sessionStorage.getItem("doodle:return")).not.toBeNull();
    expect(location.search).toBe("?checkout=cs_retry");

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect(screen.getByText("Added 10 doodles")).toBeVisible();
    const confirmationCalls = vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/checkout/confirm");
    expect(confirmationCalls).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls.some(([input]) => input === "/api/checkout")).toBe(false);
    expect(sessionStorage.getItem("doodle:return")).toBeNull();
    expect(location.search).toBe("");
    } finally { vi.useRealTimers(); }
  });

  it("selects a visual detail level without generating, remembers it and submits it", async () => {
    mockGeneration(new Response(new Blob(["png"], { type: "image/png" }), { status: 200 }));
    const view = renderClient("en", "Two cats hug");
    const trigger = await screen.findByRole("button", { name: "Detail: Medium" });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const medium = screen.getByRole("radio", { name: "Medium" });
    await waitFor(() => expect(medium).toBeEnabled());
    fireEvent.click(medium);
    await waitFor(() => expect(screen.getByRole("button", {name:"Detail: Medium"})).toHaveAttribute("aria-expanded", "false"));
    expect(window.localStorage.getItem("doodle.detail-level")).toBe("medium");
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => path === "/api/generate")).toHaveLength(0);
    view.unmount();
    renderClient("en", "Two cats hug");
    await waitFor(() => expect(screen.getByRole("button", { name: "Detail: Medium" })).toHaveAttribute("aria-expanded", "false"));
    fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/generate", expect.objectContaining({ body: JSON.stringify({ scene: "Two cats hug", detailLevel: "medium" }) })));
  });
});
