import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getCopy } from "@/lib/i18n";
import { MobileAppWorkspace } from "./mobile-app-workspace";

describe("initial installed workspace", () => {
  it("renders the installed composer before JavaScript runs when the request identifies the app", () => {
    const html = renderToStaticMarkup(<MobileAppWorkspace locale="en" copy={getCopy("en")} initialInstalled />);
    expect(html).toContain('data-installed="true"');
    expect(html).toContain("Or try one");
    expect(html).toContain('aria-label="Doodle app"');
    expect(html).not.toContain('class="landing-intro"');
  });

  it("keeps the ordinary website landing page when no app runtime is requested", () => {
    const html = renderToStaticMarkup(<MobileAppWorkspace locale="en" copy={getCopy("en")} />);
    expect(html).toContain('data-installed="false"');
    expect(html).toContain('class="landing-intro"');
    expect(html).not.toContain('aria-label="Doodle app"');
  });
});
