import { describe, expect, it } from "vitest";
import { getNativeCopy } from "../services/localization";
import { makePurchaseUi } from "./purchase-ui";

describe("native purchase presentation", () => {
  it("restores localized offer copy when reducer placeholders are passed back", () => {
    const copy = getNativeCopy("en");
    const purchase = makePurchaseUi(copy, "offer", {
      mode: "offer",
      title: "",
      body: "",
      quantityLabel: "",
      termsLabel: "",
      cancelLabel: "",
      busy: false,
    });

    expect(purchase).toMatchObject({
      title: "Keep doodling",
      quantityLabel: "10 more doodles",
      termsLabel: "One payment. No subscription.",
      cancelLabel: "Not now",
    });

    expect(makePurchaseUi(copy, "offer", { restoreLabel: "" }).restoreLabel).toBeUndefined();
  });
});
