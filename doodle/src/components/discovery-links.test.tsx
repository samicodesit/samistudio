import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AndroidAppLink, DrawingGuides, PLAY_STORE_URL } from "./discovery-links";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

describe("Discovery links", () => {
  it.each(SUPPORTED_LOCALES)("sends %s visitors to the released Android package", locale => {
    render(<AndroidAppLink locale={locale} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", PLAY_STORE_URL);
    expect(new URL(PLAY_STORE_URL).searchParams.get("id")).toBe("nl.samistudio.doodle");
  });

  it("keeps guide destinations in the visitor's language", () => {
    render(<DrawingGuides locale="nl" />);
    const links = screen.getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/nl/blog/card-doodles", "/nl/blog/lunchbox-notes", "/nl/blog/journal-doodles",
    ]);
  });
});
