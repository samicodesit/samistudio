import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultDialog } from "./result-dialog";

describe("ResultDialog", () => {
  it("opens at fit size and toggles to native resolution", () => {
    render(<ResultDialog imageUrl="blob:one" open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-view", "fit");
    expect(screen.getByRole("img", { name: "Sticky-note doodle" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /100%/ }));

    expect(screen.getByRole("dialog")).toHaveAttribute("data-view", "native");
  });

  it("closes through the explicit close control", () => {
    const onClose = vi.fn();
    render(<ResultDialog imageUrl="blob:one" open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
