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
  for (let elapsed = 0; elapsed < 36000; elapsed += 100) {
    const hint = container.querySelector(".animated-prompt-hint");
    if (hint) {
      seen.add(hint.textContent ?? "");
      expect(hint).toHaveAttribute("aria-hidden", "true");
    }
    act(() => vi.advanceTimersByTime(100));
  }
  expect(seen).toEqual(new Set(prompts));
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Create doodle" })).toBeDisabled();
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
