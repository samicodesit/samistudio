import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDoodleIdeas } from "@/lib/doodle-ideas";
import { getCopy } from "@/lib/i18n";
import { IdeaGallery } from "./idea-gallery";

const copy = getDoodleIdeas("en");

describe("IdeaGallery attribution", () => {
  it("uses the shared preview and starts each reopened idea with the grid off", () => {
    render(<IdeaGallery locale="en" copy={copy} />);
    const open = screen.getAllByRole("button", { name: new RegExp(copy.viewLarger) })[0];
    fireEvent.click(open);
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Show grid" }));
    expect(within(dialog).getByRole("button", { name: "Hide grid" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("link", { name: copy.tryIdea })).toHaveAttribute("href", expect.stringContaining("scene="));
    fireEvent.click(within(dialog).getByRole("button", { name: getCopy("en").dialog.close }));
    fireEvent.click(open);
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Show grid" })).toHaveAttribute("aria-pressed", "false");
  });
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
