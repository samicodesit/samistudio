import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing-copy";
import { SceneComposer } from "./scene-composer";

function composer(scene = "") {
  return <SceneComposer scene={scene} isGenerating={false} onSceneChange={vi.fn()} onCreate={vi.fn()} copy={getCopy("en").composer} usage="4 free doodles left" usageLoadingLabel="Account" compactHeading placeholderPrompts={getLandingCopy("en").placeholderPrompts} />;
}

afterEach(() => vi.useRealTimers());

it("cycles five distinct hints without entering text or enabling generation", () => {
  vi.useFakeTimers();
  const { container } = render(composer());
  const prompts = getLandingCopy("en").placeholderPrompts;
  expect(new Set(prompts).size).toBe(5);
  const seen = new Set<string>();
  for (let elapsed = 0; elapsed < 60000 && seen.size < prompts.length; elapsed += 20) {
    const hint = container.querySelector(".animated-prompt-hint");
    if (hint) {
      if (hint.getAttribute("data-phase") === "hold") seen.add(hint.textContent ?? "");
      expect(hint).toHaveAttribute("aria-hidden", "true");
    }
    act(() => vi.advanceTimersByTime(20));
  }
  expect(seen).toEqual(new Set(prompts));
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Create doodle" })).toBeDisabled();
});

it("types actual text from empty and removes it one character at a time", () => {
  vi.useFakeTimers();
  const { container } = render(composer());
  const hint = () => container.querySelector(".animated-prompt-hint")!;
  const prompt = getLandingCopy("en").placeholderPrompts[0];
  expect(hint().textContent).toBe("");
  let previous = "";
  let sawTyping = false;
  let sawBackspace = false;
  let reachedFullPrompt = false;
  for (let elapsed = 0; elapsed < 12000; elapsed += 20) {
    act(() => vi.advanceTimersByTime(20));
    const current = hint().textContent ?? "";
    const phase = hint().getAttribute("data-phase");
    if (phase === "typing" && current.length > previous.length) {
      expect(current).toBe(previous + prompt[previous.length]);
      sawTyping = true;
    }
    if (current === prompt) reachedFullPrompt = true;
    if (phase === "deleting" && current.length < previous.length) {
      expect(current).toBe(previous.slice(0, -1));
      sawBackspace = true;
    }
    if (sawBackspace && current === "") break;
    previous = current;
  }
  expect(sawTyping && reachedFullPrompt && sawBackspace).toBe(true);
  expect(hint().textContent).toBe("");
  expect(screen.getByRole("textbox")).toHaveValue("");
});

it("removes the animation on focus or when the user already has a draft", () => {
  const { container, rerender } = render(composer());
  expect(container.querySelector(".animated-prompt-hint")).not.toBeNull();
  fireEvent.focus(screen.getByRole("textbox"));
  expect(container.querySelector(".animated-prompt-hint")).toBeNull();
  fireEvent.blur(screen.getByRole("textbox"));
  expect(container.querySelector(".animated-prompt-hint")).not.toBeNull();
  rerender(composer("My own scene"));
  expect(container.querySelector(".animated-prompt-hint")).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue("My own scene");
});

it("keeps a static native placeholder for reduced motion", () => {
  const originalMatchMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ ...originalMatchMedia(query), matches: query.includes("prefers-reduced-motion") }));
  const { container } = render(composer());
  expect(container.querySelector(".animated-prompt-hint")).toBeNull();
  expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", getCopy("en").composer.placeholder);
});
