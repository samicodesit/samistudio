import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DoodleIdeasPage, { metadata } from "./page";

describe("DoodleIdeasPage", () => {
  it("offers eight real examples that lead back to a prefilled generator", () => {
    render(<DoodleIdeasPage />);

    expect(screen.getAllByRole("img")).toHaveLength(8);
    expect(screen.getAllByRole("link", { name: "Try this idea" })).toHaveLength(8);
    expect(screen.getAllByRole("link", { name: "Try this idea" })[0]).toHaveAttribute(
      "href",
      "/?scene=A%20steaming%20mug%20beside%20a%20folded%20thank-you%20note%20with%20a%20tiny%20heart%20on%20it#composer",
    );
  });

  it("uses the gallery metadata for social previews", () => {
    expect(metadata.twitter).toMatchObject({
      title: "Cute Doodle Ideas for Notes, Cards & Lunchboxes | Doodle",
      images: ["https://doodle.samistudio.nl/ideas/thank-you-mug.webp"],
    });
  });
});
