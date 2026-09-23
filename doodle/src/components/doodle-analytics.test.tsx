import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeforeSendEvent } from "@vercel/analytics/next";
import { DoodleAnalytics } from "./doodle-analytics";

const mock = vi.hoisted(() => ({ beforeSend: undefined as undefined | ((event: BeforeSendEvent) => BeforeSendEvent | null) }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: ({ beforeSend }: { beforeSend: typeof mock.beforeSend }) => {
  mock.beforeSend = beforeSend;
  return null;
} }));

describe("analytics URL redaction", () => {
  it.each(["pageview", "event"] as const)("removes checkout, scene and fragments from %s without changing the source event", (type) => {
    render(<DoodleAnalytics />);
    const url = "https://doodle.samistudio.nl/nl?checkout=cs_private&scene=private+description&auth=private-token&utm_source=reddit&utm_medium=community&utm_campaign=doodle_launch&utm_content=lunchbox_note#private";
    const event = type === "pageview"
      ? { type, url }
      : { type, url, payload: { name: "Doodle Shared", data: { method: "file", locale: "nl" } } };
    const result = mock.beforeSend!(event);
    expect(result).toEqual({ ...event, url: "https://doodle.samistudio.nl/nl?utm_source=reddit&utm_medium=community&utm_campaign=doodle_launch&utm_content=lunchbox_note" });
    expect(event.url).toBe(url);
  });

  it("keeps approved attribution and drops malformed or sensitive query values", () => {
    render(<DoodleAnalytics />);
    const event = {
      type: "pageview" as const,
      url: "https://doodle.samistudio.nl/?utm_source=pinterest&utm_medium=organic_social&utm_campaign=not%20an%20approved%20campaign&utm_content=bad%2Fcontent&scene=private%20prompt&access_token=secret",
    };

    expect(mock.beforeSend!(event)).toEqual({
      ...event,
      url: "https://doodle.samistudio.nl/?utm_source=pinterest&utm_medium=organic_social",
    });
  });

  it("keeps the verified Pinterest pin attribution while removing scene and auth data", () => {
    render(<DoodleAnalytics />);
    const event = {
      type: "pageview" as const,
      url: "https://doodle.samistudio.nl/?scene=A%20steaming%20mug%20beside%20a%20folded%20thank-you%20note%20with%20a%20tiny%20heart%20on%20it&utm_source=Pinterest&utm_medium=organic&utm_campaign=small_moments&utm_content=thank_you_mug&auth=private-token#composer",
    };

    expect(mock.beforeSend!(event)).toEqual({
      ...event,
      url: "https://doodle.samistudio.nl/?utm_source=Pinterest&utm_medium=organic&utm_campaign=small_moments&utm_content=thank_you_mug",
    });
  });

  it("preserves a normal URL and drops malformed URLs", () => {
    render(<DoodleAnalytics />);
    const event = { type: "pageview" as const, url: "https://doodle.samistudio.nl/doodle-ideas" };
    expect(mock.beforeSend!(event)).toEqual(event);
    expect(mock.beforeSend!({ ...event, url: "not a URL?scene=private" })).toBeNull();
  });
});
