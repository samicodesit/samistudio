import { describe, expect, it } from "vitest";
import { getPlayCatalog } from "../../../src/lib/billing/play-catalog";
import { exhaustedPurchaseHistory, makePackPurchaseUi } from "./pack-purchase-ui";
import type { NativePackCatalog } from "../contracts/native";

function catalog(at: string): NativePackCatalog {
  return { ...getPlayCatalog(new Date(at)), packs: getPlayCatalog(new Date(at)).packs.map(pack => ({ ...pack, priceLabel: "€" + (pack.productId === "pack_mini" ? "1.99" : pack.productId === "pack_regular" ? "4.99" : "9.99"), price: pack.productId === "pack_mini" ? 1.99 : pack.productId === "pack_regular" ? 4.99 : 9.99, priceMicros: pack.productId === "pack_mini" ? 1990000 : pack.productId === "pack_regular" ? 4990000 : 9990000, currency: "EUR" })) };
}

describe("pack purchase presentation", () => {
  it("uses the Arabic plural for the Mini pack and its purchase action", () => {
    const ui = makePackPurchaseUi("ar", catalog("2026-10-10T12:00:00Z"), "pack_mini", false);
    expect(ui.quantityLabel).toBe("6 رسومات");
    expect(ui.packs?.[0].quantityLabel).toBe("6 رسومات");
    expect(ui.buyLabel).toBe("احصل على 6 رسومات · €1.99");
  });
  it("only claims exhaustion after the remaining allowance is empty", () => {
    expect(exhaustedPurchaseHistory(false, 0, null)).toBe(false);
    expect(exhaustedPurchaseHistory(true, null, 0)).toBe(true);
    expect(exhaustedPurchaseHistory(true, 3, 0)).toBe(true);
    expect(exhaustedPurchaseHistory(false, 2, 0)).toBeUndefined();
    expect(exhaustedPurchaseHistory(true, 0, 6)).toBeUndefined();
    expect(exhaustedPurchaseHistory(false, null, 0)).toBeUndefined();
  });
  it("uses the launch catalog for quantity, price per doodle and offer date", () => {
    const ui = makePackPurchaseUi("en", catalog("2026-10-31T22:59:59Z"), "pack_regular", false);
    expect(ui.body).toBe("Your 4 free doodles are used.\nPick a pack, one-time, no subscription.");
    expect(ui.buyLabel).toBe("Get 25 doodles · €4.99");
    expect(ui.packs?.[1]).toMatchObject({ quantityLabel: "25 doodles", unitPriceLabel: "€0.20 each", caption: "Plenty for lunchbox notes and cards", offerLabel: "Launch offer: 25 instead of 20 · ends 31 Oct" });
  });
  it("changes both the unit price and the offer line after expiry", () => {
    const ui = makePackPurchaseUi("en", catalog("2026-10-31T23:00:00Z"), "pack_regular", true);
    expect(ui.body).toBe("You're out of doodles.\nPick a pack, one-time, no subscription.");
    expect(ui.buyLabel).toBe("Get 20 doodles · €4.99");
    expect(ui.packs?.[1]).toMatchObject({ quantityLabel: "20 doodles", unitPriceLabel: "€0.25 each" });
    expect(ui.packs?.[1].offerLabel).toBeUndefined();
  });
  it("retains Play's price label and derives the unit price from micros", () => {
    const packs = catalog("2026-10-10T12:00:00Z");
    packs.packs[0] = { ...packs.packs[0], priceLabel: "CA$2.99", price: 1234, priceMicros: 2990000, currency: "CAD" };
    const ui = makePackPurchaseUi("en", packs, "pack_mini", false);
    expect(ui.buyLabel).toBe("Get 6 doodles · CA$2.99");
    expect(ui.packs?.[0].unitPriceLabel).toContain("0.50");
    expect(ui.packs?.[0].unitPriceLabel).not.toContain("€");
  });
  it("uses neutral copy until purchase history is known", () => {
    const ui = makePackPurchaseUi("en", catalog("2026-10-10T12:00:00Z"), "pack_big", undefined);
    expect(ui.body).toBe("Pick a pack, one-time, no subscription.");
    expect(ui.buyLabel).toBe("Get 60 doodles · €9.99");
  });
  it.each(["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko", "ar"] as const)("keeps %s pack presentation complete across expiry", locale => {
    const launch = makePackPurchaseUi(locale, catalog("2026-10-10T12:00:00Z"), "pack_big", false);
    const expired = makePackPurchaseUi(locale, catalog("2026-11-01T12:00:00Z"), "pack_big", true);
    expect(launch.packs).toHaveLength(3);
    expect(launch.packs?.[2].selected).toBe(true);
    expect(launch.packs?.[1].offerLabel).toBeTruthy();
    expect(expired.packs?.[1].offerLabel).toBeUndefined();
    expect(expired.packs?.[1].unitPriceLabel).not.toBe(launch.packs?.[1].unitPriceLabel);
    expect(expired.body).not.toBe(launch.body);
    expect(JSON.stringify(expired)).not.toMatch(/\{(?:count|price|normal|date)\}/);
  });
});
