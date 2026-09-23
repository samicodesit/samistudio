import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DoodleIdeasPage } from "@/components/doodle-ideas-page";
import DoodleIdeasRoute, { metadata } from "./page";

afterEach(() => {
  window.history.replaceState({}, "", "/doodle-ideas");
});

describe("DoodleIdeasPage", () => {
  it("offers eight real examples that lead back to a prefilled generator", () => {
    render(<DoodleIdeasRoute />);

    expect(screen.getAllByRole("img")).toHaveLength(8);
    expect(screen.getAllByRole("link", { name: "Try this idea" })).toHaveLength(8);
    expect(screen.getAllByRole("link", { name: "Try this idea" })[0]).toHaveAttribute(
      "href",
      "/?scene=A%20steaming%20mug%20beside%20a%20folded%20thank-you%20note%20with%20a%20tiny%20heart%20on%20it#composer",
    );
  });

  it("does not repeat arbitrary use-case labels on every drawing", () => {
    render(<DoodleIdeasRoute />);

    expect(screen.queryByText("Lunchboxes")).not.toBeInTheDocument();
    expect(screen.queryByText("Classroom")).not.toBeInTheDocument();
  });

  it("uses the gallery metadata for social previews", () => {
    expect(metadata.twitter).toMatchObject({
      title: "Cute Doodle Ideas for Notes, Cards & Lunchboxes | Doodle",
      images: ["https://doodle.samistudio.nl/ideas/thank-you-mug.webp"],
    });
  });

  it("forwards approved attribution on the other generator CTAs", async () => {
    window.history.replaceState({}, "", "/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card&scene=private&auth=private-token");
    render(<DoodleIdeasPage locale="en" />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Make a doodle" })).toHaveAttribute(
        "href",
        "/?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card#composer",
      );
      expect(screen.getByRole("link", { name: "Try this idea: A tiny frog sheltering under a leaf" })).toHaveAttribute(
        "href",
        "/?scene=A%20tiny%20frog%20sheltering%20under%20a%20leaf&utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card#composer",
      );
      expect(screen.getByRole("link", { name: "Turn your idea into a doodle" })).toHaveAttribute(
        "href",
        "/?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card#composer",
      );
    });
  });
});
