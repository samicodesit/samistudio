import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { DoodleStage } from "./doodle-stage";

const lottie = vi.hoisted(() => {
  const listeners = new Map<string, () => void>();
  const animation = { play: vi.fn(), pause: vi.fn(), goToAndStop: vi.fn(), destroy: vi.fn(), addEventListener: vi.fn((name: string, callback: () => void) => listeners.set(name, callback)) };
  return { animation, listeners, loadAnimation: vi.fn(() => animation) };
});
vi.mock("lottie-web", () => ({ default: { loadAnimation: lottie.loadAnimation } }));

describe("DoodleStage", () => {
  it("offers an accessible grid toggle only for a finished doodle", () => {
    const onToggleGrid = vi.fn();
    const props = { imageUrl: "blob:doodle", error: null, copy: getCopy("en").stage, onToggleGrid };
    const { rerender } = render(<DoodleStage {...props} status="ready" gridEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show grid" }));
    expect(onToggleGrid).toHaveBeenCalledOnce();
    rerender(<DoodleStage {...props} status="ready" gridEnabled />);
    expect(screen.getByRole("button", { name: "Hide grid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:doodle");
    rerender(<DoodleStage {...props} status="idle" gridEnabled />);
    expect(screen.queryByRole("button", { name: /grid/i })).not.toBeInTheDocument();
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rolls messages on Android's three-second cadence, loops and resets on another drawing", () => {
    const props = { imageUrl: null, error: null, copy: getCopy("en").stage };
    const { rerender, container } = render(<DoodleStage {...props} status="generating" />);
    const track = () => container.querySelector(".loading-message-track")!;
    expect(track()).toHaveAttribute("data-index", "0");
    act(() => vi.advanceTimersByTime(2580));
    expect(track()).toHaveAttribute("data-rolling", "true");
    act(() => vi.advanceTimersByTime(420));
    expect(track()).toHaveAttribute("data-index", "1");
    expect(track()).toHaveAttribute("data-rolling", "false");
    act(() => vi.advanceTimersByTime(12000));
    expect(track()).toHaveAttribute("data-index", "0");
    act(() => vi.advanceTimersByTime(3000));
    rerender(<DoodleStage {...props} status="idle" />);
    rerender(<DoodleStage {...props} status="generating" />);
    expect(track()).toHaveAttribute("data-index", "0");
  });

  it("pauses in the background and resumes with Android's full phrase hold", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { container } = render(<DoodleStage status="generating" imageUrl={null} error={null} copy={getCopy("en").stage} />);
    const track = container.querySelector(".loading-message-track")!;
    act(() => vi.advanceTimersByTime(2580));
    expect(track).toHaveAttribute("data-rolling", "true");
    act(() => {
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => vi.advanceTimersByTime(12000));
    expect(track).toHaveAttribute("data-index", "0");
    expect(track).toHaveAttribute("data-rolling", "false");
    act(() => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => vi.advanceTimersByTime(2579));
    expect(track).toHaveAttribute("data-rolling", "false");
    act(() => vi.advanceTimersByTime(1));
    expect(track).toHaveAttribute("data-rolling", "true");
    act(() => vi.advanceTimersByTime(420));
    expect(track).toHaveAttribute("data-index", "1");
  });

  it("uses the native asset, stops on Android's reduced-motion frame and disposes the player", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((media) => ({ matches: true, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    const { unmount, container } = render(<DoodleStage status="generating" imageUrl={null} error={null} copy={getCopy("en").stage} />);
    await act(async () => { await Promise.resolve(); });
    expect(lottie.loadAnimation).toHaveBeenCalledWith(expect.objectContaining({ path: "/animations/pencil-loader.json", autoplay: false, loop: true }));
    act(() => lottie.listeners.get("DOMLoaded")?.());
    expect(lottie.animation.goToAndStop).toHaveBeenCalledWith(324, true);
    act(() => vi.advanceTimersByTime(15000));
    expect(container.querySelector(".loading-message-track")).toHaveAttribute("data-index", "0");
    unmount();
    expect(lottie.animation.destroy).toHaveBeenCalled();
  });
});
