import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultDialog } from "./result-dialog";

describe("ResultDialog", () => {
  it("opens the image at native resolution in a new tab", () => {
    render(<ResultDialog imageUrl="blob:one" open onClose={vi.fn()} />);

    expect(screen.queryByText("Doodle, up close")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A closer look" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sticky-note doodle" })).toBeVisible();

    const nativeLink = screen.getByRole("link", { name: "View at 100%" });
    expect(nativeLink).toHaveAttribute("href", "blob:one");
    expect(nativeLink).toHaveAttribute("target", "_blank");
    expect(nativeLink).toHaveAttribute("rel", "noreferrer");
  });

  it("closes through the explicit close control", () => {
    const onClose = vi.fn();
    render(<ResultDialog imageUrl="blob:one" open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
