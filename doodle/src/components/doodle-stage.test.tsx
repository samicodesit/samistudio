import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { DoodleStage } from "./doodle-stage";

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

  it("changes its visual waiting message as a long generation continues", () => {
    render(<DoodleStage status="generating" imageUrl={null} error={null} copy={getCopy("en").stage} />);
    expect(screen.getByText("Clearing a fresh note…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(8000));

    expect(screen.getByText("Sketching the main shapes…")).toBeInTheDocument();
  });
});
