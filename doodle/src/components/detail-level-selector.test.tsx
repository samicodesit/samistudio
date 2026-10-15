import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { DetailLevelSelector } from "./detail-level-selector";
import type { DetailLevel } from "@/lib/generation/detail-level";

describe("visual detail selector", () => {
  it("uses one tab stop and keyboard arrows to choose and focus the next tile", async () => {
    const onChange = vi.fn();
    function Selector() {
      const [value, setValue] = useState<DetailLevel>("simple");
      return <DetailLevelSelector locale="en" value={value} onChange={level => { onChange(level); setValue(level); }} />;
    }
    render(<Selector />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Simple" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Simple" })).toHaveAttribute("tabindex", "-1");
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Detailed" })).toHaveFocus();
    expect(onChange.mock.calls.map(([level]) => level)).toEqual(["medium", "detailed"]);
  });
  it("disables selection without hiding its selected state", () => {
    const onChange = vi.fn();
    render(<DetailLevelSelector locale="en" value="medium" onChange={onChange} disabled />);
    const radio = screen.getByRole("radio", { name: "Medium" });
    expect(radio).toHaveAttribute("aria-checked", "true");
    fireEvent.click(radio);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("reverses horizontal arrow movement for Arabic", () => {
    const onChange = vi.fn();
    render(<DetailLevelSelector locale="ar" value="simple" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "بسيط" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("medium");
  });
});

describe("detail drawer", () => {
  it("hides and reveals without changing the selected level", async () => {
    const onChange = vi.fn();
    render(<DetailLevelSelector locale="en" value="detailed" onChange={onChange} />);
    const toggle = screen.getByRole("button", { name: /Hide detail/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(toggle);
    expect(screen.getByRole("radio", { name: "Detailed" })).toHaveAttribute("aria-checked", "true");
  });
});
