import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCopy, type Locale } from "@/lib/i18n";
import { DoodleClient } from "./doodle-client";

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

describe("DoodleClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:one");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (input === "/api/account") return json(anonymousAccount);
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
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

  it("shows a zero paid balance instead of anonymous trial copy when signed in", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }),
    );

    renderClient();

    await waitFor(() => expect(screen.getByText("0 doodles left", { selector: ".usage-copy" })).toBeVisible());
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
});
