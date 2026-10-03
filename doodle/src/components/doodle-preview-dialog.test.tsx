import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { DoodlePreviewDialog } from "./doodle-preview-dialog";

const copy = getCopy("en").dialog;

describe("DoodlePreviewDialog", () => {
  it("opens the image at native resolution in a new tab", () => {
    render(<DoodlePreviewDialog imageUrl="blob:one" open onClose={vi.fn()} copy={copy} />);

    expect(screen.queryByText("Doodle, up close")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A closer look" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sticky-note doodle" })).toBeVisible();

    const nativeLink = screen.getByRole("link", { name: "Open in new tab" });
    expect(nativeLink).toHaveAttribute("href", "blob:one");
    expect(nativeLink).toHaveAttribute("target", "_blank");
    expect(nativeLink).toHaveAttribute("rel", "noreferrer");
  });

  it("closes through the explicit close control", () => {
    const onClose = vi.fn();
    render(<DoodlePreviewDialog imageUrl="blob:one" open onClose={onClose} copy={copy} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets an example preview toggle the grid without changing its original links", () => {
    const { container } = render(<DoodlePreviewDialog imageUrl="/example.png" open onClose={vi.fn()} copy={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Show grid" }));
    expect(screen.getByRole("button", { name: "Hide grid" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".copy-grid-overlay")).toHaveAttribute("data-enabled", "true");
    expect(screen.getByRole("link", { name: copy.download })).toHaveAttribute("href", "/example.png");
  });
});
