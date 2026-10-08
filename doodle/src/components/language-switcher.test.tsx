import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "./language-switcher";

afterEach(() => vi.useRealTimers());

it("opens flagged language links and preserves their destinations", () => {
  const { container } = render(<LanguageSwitcher locale="en" />);
  fireEvent.click(container.querySelector("summary")!);
  expect(container.querySelector("details")).toHaveAttribute("open");
  expect(container.querySelectorAll("img")).toHaveLength(10);
  expect(screen.getByRole("link", { name: "Nederlands" })).toHaveAttribute("href", "/nl");
  expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute("href", "/ja");
});

it("animates closing before hiding the menu and returns Escape focus to the trigger", () => {
  vi.useFakeTimers();
  const { container } = render(<LanguageSwitcher locale="en" />);
  const trigger = container.querySelector("summary")!;
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(container.querySelector("details")).toHaveAttribute("data-state", "closing");
  expect(container.querySelector("details")).toHaveAttribute("open");
  expect(trigger).toHaveFocus();
  act(() => vi.advanceTimersByTime(180));
  expect(container.querySelector("details")).not.toHaveAttribute("open");
});

it("closes when the user presses outside the dropdown", () => {
  const { container } = render(<LanguageSwitcher locale="en" />);
  fireEvent.click(container.querySelector("summary")!);
  fireEvent.pointerDown(document.body);
  expect(container.querySelector("details")).toHaveAttribute("data-state", "closing");
});

it("also closes when keyboard focus leaves the dropdown", () => {
  const { container } = render(<LanguageSwitcher locale="en" />);
  const trigger = container.querySelector("summary")!;
  fireEvent.click(trigger);
  fireEvent.blur(trigger, { relatedTarget: document.body });
  expect(container.querySelector("details")).toHaveAttribute("data-state", "closing");
});
