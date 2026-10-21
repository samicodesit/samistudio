import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { MobileAppWorkspace } from "./mobile-app-workspace";

vi.mock("./doodle-client", () => ({
  DoodleClient: () => <div data-testid="doodle-client" />,
}));

afterEach(() => vi.restoreAllMocks());

describe("MobileAppWorkspace", () => {
  it("keeps an ordinary fullscreen browser on the wide website", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("fullscreen"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
    const { container } = render(<MobileAppWorkspace locale="en" copy={getCopy("en")} />);
    expect(container.querySelector(".mobile-app-workspace")).toHaveAttribute("data-installed", "false");
    expect(container.querySelector(".app-bottom-nav")).toBeNull();
  });

  it("retains the compact navigation in a standalone installed app", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("standalone"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
    const { container } = render(<MobileAppWorkspace locale="en" copy={getCopy("en")} />);
    expect(container.querySelector(".mobile-app-workspace")).toHaveAttribute("data-installed", "true");
    expect(container.querySelector(".app-bottom-nav")).not.toBeNull();
  });

  it("renders the stable app account host above the workspace", () => {
    const { container } = render(<MobileAppWorkspace locale="en" copy={getCopy("en")} />);

    expect(container.querySelector('[data-account-host="app"]')).toHaveAttribute("aria-label", "Account");
  });
});
