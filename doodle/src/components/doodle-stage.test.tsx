import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { DoodleStage } from "./doodle-stage";

describe("DoodleStage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("changes its visual waiting message as a long generation continues", () => {
    render(<DoodleStage status="generating" imageUrl={null} error={null} copy={getCopy("en").stage} />);
    expect(screen.getByText("Clearing a fresh note…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(8000));

    expect(screen.getByText("Sketching the main shapes…")).toBeInTheDocument();
  });
});
