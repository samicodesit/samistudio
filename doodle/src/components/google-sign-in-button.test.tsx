import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton, isIosBrowser } from "./google-sign-in-button";

vi.mock("next/script", () => ({ default: () => null }));

describe("iOS Google sign-in detection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes iPhone and iPad desktop user agents", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 });
    expect(isIosBrowser()).toBe(true);

    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 });
    expect(isIosBrowser()).toBe(true);
  });

  it("does not classify a desktop browser as iOS", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 });
    expect(isIosBrowser()).toBe(false);

    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 5 });
    expect(isIosBrowser()).toBe(false);
  });
});

const renderButton = vi.fn();
const initialize = vi.fn();

describe("Google sign-in button", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-id");
    renderButton.mockReset();
    initialize.mockReset();
    window.google = { accounts: { id: { initialize, renderButton } } };
  });

  it("renders Google's localized official control and forwards its credential", async () => {
    const onCredential = vi.fn();
    render(<GoogleSignInButton locale="pt-br" busy={false} onCredential={onCredential} onError={vi.fn()} />);

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: "google-client-id" }));
    expect(renderButton).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ locale: "pt_BR", width: expect.any(Number) }));
    const options = initialize.mock.calls[0][0];
    options.callback({ credential: "google-token" });
    expect(onCredential).toHaveBeenCalledWith("google-token");
  });

  it("does not rebuild Google's iframe when its width is unchanged", async () => {
    let resize: ResizeObserverCallback = () => undefined;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    render(<GoogleSignInButton locale="en" busy={false} onCredential={vi.fn()} onError={vi.fn()} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));

    resize([], {} as ResizeObserver);

    expect(renderButton).toHaveBeenCalledTimes(1);
  });

  it("keeps the intermediate Google DOM covered until its iframe is visible", async () => {
    let iframe: HTMLIFrameElement | undefined;
    renderButton.mockImplementation((element: HTMLElement) => {
      const fallback = document.createElement("div");
      fallback.setAttribute("role", "button");
      fallback.textContent = "Continue with Google";
      iframe = document.createElement("iframe");
      Object.defineProperty(iframe, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
      });
      element.replaceChildren(fallback, iframe);
    });

    render(<GoogleSignInButton locale="en" busy={false} onCredential={vi.fn()} onError={vi.fn()} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    expect(document.querySelector(".google-sign-in-loading")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading sign-in…");
    const control = document.querySelector(".google-sign-in-control") as HTMLElement;
    expect(control).toHaveAttribute("aria-hidden", "true");
    expect(control.inert).toBe(true);

    Object.defineProperty(iframe, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ width: 368, height: 44, top: 0, left: 0, right: 368, bottom: 44 }),
    });
    expect(iframe).toBeDefined();
    expect(iframe?.getBoundingClientRect().width).toBe(368);
    iframe?.style.setProperty("height", "44px");

    await waitFor(() => expect(document.querySelector(".google-sign-in-loading")).not.toBeInTheDocument());
    expect(control).toHaveAttribute("aria-hidden", "false");
    expect(control.inert).toBe(false);
  });

  it("does not reveal a fallback before the next frame confirms that no iframe arrived", async () => {
    let confirmFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      confirmFrame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    renderButton.mockImplementation((element: HTMLElement) => {
      const fallback = document.createElement("div");
      fallback.setAttribute("role", "button");
      fallback.textContent = "Continue with Google";
      Object.defineProperty(fallback, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ width: 348, height: 40, top: 0, left: 0, right: 348, bottom: 40 }),
      });
      element.replaceChildren(fallback);
    });

    render(<GoogleSignInButton locale="en" busy={false} onCredential={vi.fn()} onError={vi.fn()} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    expect(document.querySelector(".google-sign-in-loading")).toBeInTheDocument();
    expect(confirmFrame).toBeDefined();

    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    });
    const control = document.querySelector(".google-sign-in-control") as HTMLElement;
    control.appendChild(iframe);
    act(() => confirmFrame?.(0));

    expect(document.querySelector(".google-sign-in-loading")).toBeInTheDocument();
    expect(control).toHaveAttribute("aria-hidden", "true");
  });

  it("returns to loading when the rendered iframe becomes unusable", async () => {
    let iframe: HTMLIFrameElement | undefined;
    renderButton.mockImplementation((element: HTMLElement) => {
      iframe = document.createElement("iframe");
      Object.defineProperty(iframe, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ width: 368, height: 44, top: 0, left: 0, right: 368, bottom: 44 }),
      });
      element.replaceChildren(iframe);
    });
    render(<GoogleSignInButton locale="en" busy={false} onCredential={vi.fn()} onError={vi.fn()} />);

    await waitFor(() => expect(document.querySelector(".google-sign-in-loading")).not.toBeInTheDocument());
    Object.defineProperty(iframe, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    });
    iframe?.style.setProperty("height", "0px");

    await waitFor(() => expect(document.querySelector(".google-sign-in-loading")).toBeInTheDocument());
  });
  it("configures Google's redirect UX when requested", async () => {
    render(<GoogleSignInButton locale="en" busy={false} redirect onCredential={vi.fn()} onError={vi.fn()} />);

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith({
      client_id: "google-client-id",
      ux_mode: "redirect",
      login_uri: "https://doodle.samistudio.nl/api/auth/google/redirect",
    });
  });
  it("stops reporting loading when the widget never becomes usable", async () => {
    vi.useFakeTimers();
    try {
      const onError = vi.fn();
      render(<GoogleSignInButton locale="en" busy={false} onCredential={vi.fn()} onError={onError} />);
      expect(renderButton).toHaveBeenCalledTimes(1);

      act(() => vi.advanceTimersByTime(5_000));

      expect(onError).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".google-sign-in-loading")).not.toBeInTheDocument();
      expect(document.querySelector(".google-sign-in")).toHaveAttribute("aria-busy", "false");
    } finally {
      vi.useRealTimers();
    }
  });
});
