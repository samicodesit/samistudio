import { describe, expect, it } from "vitest";
import { detailDockSwipe } from "./detail-dock";

describe("detail dock gesture", () => {
  it("uses deliberate vertical swipes and ignores taps or horizontal gestures", () => {
    expect(detailDockSwipe(3, 32)).toBe(false);
    expect(detailDockSwipe(3, -32)).toBe(true);
    expect(detailDockSwipe(0, 14)).toBeNull();
    expect(detailDockSwipe(45, 32)).toBeNull();
  });
});
