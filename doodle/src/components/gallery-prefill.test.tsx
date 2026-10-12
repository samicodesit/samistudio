import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DoodlePage } from "./doodle-page";
import { DETAIL_STORAGE_KEY } from "@/lib/generation/detail-level";
import { readGalleryDetail } from "@/lib/gallery-navigation";

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
});

it("tries a homepage example without a navigation reload or a generation call", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 })));
  render(<DoodlePage locale="en" initialScene="My existing draft" />);
  await screen.findByText("2 free doodles left");
  fireEvent.click(screen.getByRole("button", { name: "View larger: A cozy bookshop" }));
  fireEvent.click(screen.getByRole("link", { name: "Try this idea" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("A cozy bookshop with plants and a bicycle outside");
  expect(screen.getByRole("radio", { name: "Detailed" })).toHaveAttribute("aria-checked", "true");
  expect(vi.mocked(fetch).mock.calls.every(([url]) => url === "/api/account")).toBe(true);
});
afterEach(() => { vi.unstubAllGlobals(); });

it("prefills the requested detail over a saved preference without generating or changing the preference", async () => {
  window.localStorage.setItem(DETAIL_STORAGE_KEY, "simple");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 })));
  render(<DoodlePage locale="en" initialScene="A cozy bookshop" initialDetailLevel="detailed" />);
  await screen.findByText("2 free doodles left");
  expect(screen.getByRole("textbox")).toHaveValue("A cozy bookshop");
  expect(screen.getByRole("radio", { name: "Detailed" })).toHaveAttribute("aria-checked", "true");
  expect(window.localStorage.getItem(DETAIL_STORAGE_KEY)).toBe("simple");
  expect(vi.mocked(fetch).mock.calls.every(([url]) => url === "/api/account")).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
  expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
  expect(window.localStorage.getItem(DETAIL_STORAGE_KEY)).toBe("medium");
});

it.each(["?detail=invalid", "?detail=medium&detail=simple", "?detail=", ""])("ignores ambiguous or invalid detail: %s", search => {
  expect(readGalleryDetail(search)).toBe("all");
});
