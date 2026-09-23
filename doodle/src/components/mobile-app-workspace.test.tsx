import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCopy } from "@/lib/i18n";
import { MobileAppWorkspace } from "./mobile-app-workspace";

vi.mock("./doodle-client", () => ({
  DoodleClient: () => <div data-testid="doodle-client" />,
}));

describe("MobileAppWorkspace", () => {
  it("renders the stable app account host above the workspace", () => {
    const { container } = render(<MobileAppWorkspace locale="en" copy={getCopy("en")} />);

    expect(container.querySelector('[data-account-host="app"]')).toHaveAttribute("aria-label", "Account");
  });
});
