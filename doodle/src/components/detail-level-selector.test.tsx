import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { DetailLevelSelector } from "./detail-level-selector";
import type { DetailLevel } from "@/lib/generation/detail-level";

function StatefulSelector() {
  const [value, setValue] = useState<DetailLevel>("medium");
  return <DetailLevelSelector locale="en" value={value} onChange={setValue} />;
}
describe("compact visual detail selector", () => {
  it("shows a real selected example, opens comparison and updates both label and example", async () => {
    render(<StatefulSelector />);
    const trigger=screen.getByRole("button", {name:"Detail: Medium"});
    expect(trigger.querySelector("img")).toHaveAttribute("src",expect.stringContaining("birthday-dog-medium"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog",{name:"Drawing detail"})).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    await userEvent.click(screen.getByRole("radio",{name:"Detailed"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button",{name:"Detail: Detailed"}).querySelector("img")).toHaveAttribute("src",expect.stringContaining("birthday-dog-detailed"));
    expect(screen.getByRole("button",{name:"Detail: Detailed"})).toHaveFocus();
  });
  it("supports radio keyboard navigation and Escape without changing the selection on dismiss", async () => {
    render(<StatefulSelector />);
    await userEvent.click(screen.getByRole("button",{name:"Detail: Medium"}));
    const radio=screen.getByRole("radio",{name:"Medium"});
    radio.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio",{name:"Detailed"})).toHaveAttribute("aria-checked","true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button",{name:"Detail: Detailed"})).toHaveFocus();
  });
  it("disables opening while retaining the visible selected level", async () => {
    render(<DetailLevelSelector locale="en" value="medium" onChange={vi.fn()} disabled />);
    const trigger=screen.getByRole("button",{name:"Detail: Medium"});
    expect(trigger).toBeDisabled();fireEvent.click(trigger);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("reverses keyboard movement for Arabic", async () => {
    const onChange=vi.fn();render(<DetailLevelSelector locale="ar" value="medium" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("radio",{name:"متوسط"}),{key:"ArrowLeft"});
    expect(onChange).toHaveBeenCalledWith("detailed");
  });
});
