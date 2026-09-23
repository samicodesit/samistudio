import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDoodleIdeas } from "@/lib/doodle-ideas";
import { IdeaGallery } from "./idea-gallery";

const copy = getDoodleIdeas("en");

describe("IdeaGallery attribution", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card&scene=private");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/doodle-ideas");
  });

  it("carries approved inbound attribution through the Try this idea CTA", async () => {
    render(<IdeaGallery locale="en" copy={copy} />);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: copy.tryIdea })[0]).toHaveAttribute(
        "href",
        "/?scene=A%20steaming%20mug%20beside%20a%20folded%20thank-you%20note%20with%20a%20tiny%20heart%20on%20it&utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card#composer",
      );
    });
  });
});
