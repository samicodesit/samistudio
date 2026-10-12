import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getGalleryItems } from "@/lib/gallery-catalog";
import { getGalleryCopy } from "@/lib/gallery-copy";
import { IdeaGallery } from "./idea-gallery";
import { getDoodleIdeas } from "@/lib/doodle-ideas";

afterEach(() => window.history.replaceState({}, "", "/"));
describe("gallery browsing", () => {
  it("filters by detail, follows browser history, and opens the correct filtered image", () => {
    window.history.replaceState({}, "", "/doodle-ideas?utm_source=pinterest");
    render(<IdeaGallery locale="en" items={getGalleryItems("en")} labels={{ ...getDoodleIdeas("en"), all: getGalleryCopy("en").all }} />);
    expect(screen.getAllByRole("article")).toHaveLength(31);
    expect(screen.queryByRole("link", { name: "Try this idea" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Detailed" }));
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(new URLSearchParams(location.search).get("detail")).toBe("detailed");
    const card = screen.getAllByRole("article")[0];
    const image = within(card).getByRole("img");
    fireEvent.click(within(card).getByRole("button"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img")).toHaveAttribute("alt", image.getAttribute("alt"));
    const destination = new URL(within(dialog).getByRole("link", { name: "Try this idea" }).getAttribute("href")!, "https://doodle.samistudio.nl");
    expect(destination.searchParams.get("detail")).toBe("detailed");
    expect(destination.searchParams.get("utm_source")).toBe("pinterest");
    expect(destination.hash).toBe("#doodle-tool");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close image" }));
    act(() => { window.history.replaceState({}, "", "/doodle-ideas?detail=medium"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
  });
  it("ignores unknown detail filters", () => {
    window.history.replaceState({}, "", "/doodle-ideas?detail=unknown");
    render(<IdeaGallery locale="en" items={getGalleryItems("en")} labels={{ ...getDoodleIdeas("en"), all: getGalleryCopy("en").all }} />);
    expect(screen.getAllByRole("article")).toHaveLength(31);
  });
});
