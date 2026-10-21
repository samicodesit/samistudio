import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DoodleIdeasPage } from "@/components/doodle-ideas-page";
import DoodleIdeasRoute, { metadata } from "./page";

afterEach(() => {
  window.history.replaceState({}, "", "/doodle-ideas");
});

describe("DoodleIdeasPage", () => {
  it("offers 31 examples with the creation action inside the preview", () => {
    render(<DoodleIdeasRoute />);
    expect(screen.getAllByRole("article")).toHaveLength(31);
    expect(screen.queryByRole("link", { name: "Try this idea" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View larger: A cozy bookshop" }));
    expect(screen.getByRole("link", { name: "Try this idea" })).toHaveAttribute("href", "/?scene=A%20cozy%20bookshop%20with%20plants%20and%20a%20bicycle%20outside&detail=detailed#doodle-tool");
  });

  it("does not repeat arbitrary use-case labels on every drawing", () => {
    render(<DoodleIdeasRoute />);

    expect(screen.queryByText("Lunchboxes")).not.toBeInTheDocument();
    expect(screen.queryByText("Classroom")).not.toBeInTheDocument();
  });

  it("uses the gallery metadata for social previews", () => {
    expect(metadata.twitter).toMatchObject({
      title: "Cute Doodle Ideas for Notes, Cards & Lunchboxes | Doodle",
      images: [{ url: "https://doodle.samistudio.nl/social/doodle-og-2026-10-14.png", alt: expect.stringContaining("bear") }],
    });
  });

  it("forwards approved attribution only on the modal creator destination", () => {
    window.history.replaceState({}, "", "/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card&scene=private&auth=private-token");
    render(<DoodleIdeasPage locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "View larger: A cozy bookshop" }));
    expect(screen.getByRole("link", { name: "Try this idea" })).toHaveAttribute(
      "href",
      "/?scene=A%20cozy%20bookshop%20with%20plants%20and%20a%20bicycle%20outside&detail=detailed&utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card#doodle-tool",
    );
    expect(screen.queryByRole("link", { name: "Make a doodle" })).not.toBeInTheDocument();
  });
});
