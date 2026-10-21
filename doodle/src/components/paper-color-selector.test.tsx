import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PaperColorSelector } from "./paper-color-selector";
it("exposes seven named paper choices and an explicit selected state", () => {
 const onChange=vi.fn(); render(<PaperColorSelector locale="en" value="mint" onChange={onChange} />);
 expect(screen.getAllByRole("radio")).toHaveLength(7);
 expect(screen.getByRole("radio",{name:"Mint"})).toBeChecked();
 fireEvent.click(screen.getByRole("radio",{name:"White"})); expect(onChange).toHaveBeenCalledWith("white");
});
it("disables selection while busy and localizes names", () => {
 const onChange=vi.fn();render(<PaperColorSelector locale="ar" value="blue" disabled onChange={onChange}/>);
 expect(screen.getByRole("radio",{name:"أزرق"})).toBeChecked();
 for(const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
});
