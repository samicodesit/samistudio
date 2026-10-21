import type { NativePackCatalog, PlayPackId } from "../contracts/native";
import type { NativeLocale, NativePurchaseUi } from "../ui/types";
import { fillPackText, getNativePackCopy } from "../services/pack-copy";

export function exhaustedPurchaseHistory(hasPurchased: boolean | undefined, freeRemaining: number | null, paidRemaining: number | null): boolean | undefined {
  if (paidRemaining !== null && paidRemaining > 0) return undefined;
  if (hasPurchased === true && paidRemaining === 0) return true;
  if (freeRemaining !== null && freeRemaining > 0) return undefined;
  return freeRemaining === 0 ? hasPurchased : undefined;
}

export function makePackPurchaseUi(locale: NativeLocale, catalog: NativePackCatalog, selectedId: PlayPackId, hasPurchased: boolean | undefined, overrides: Partial<NativePurchaseUi> = {}): NativePurchaseUi {
  const copy = getNativePackCopy(locale);
  const selected = catalog.packs.find(pack => pack.productId === selectedId) ?? catalog.packs[1];
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(catalog.offerEnd));
  const lead = hasPurchased === true ? copy.returning : hasPurchased === false ? copy.first : "";
  return {
    visible: true, mode: "offer", title: copy.title, body: [lead, copy.terms].filter(Boolean).join("\n"),
    quantityLabel: fillPackText(getNativePackCopy(locale, selected.credits).quantity, { count: selected.credits }), priceLabel: selected.priceLabel,
    termsLabel: copy.neverExpire, failedGenerationsLabel: copy.failedFree, cancelLabel: copy.notNow,
    buyLabel: fillPackText(getNativePackCopy(locale, selected.credits).buy, { count: selected.credits, price: selected.priceLabel }), busy: false,
    ...overrides,
    ...((overrides.mode === "pending" || overrides.mode === "checkout") ? { buyLabel: copy.processing, busy: true, errorLabel: undefined } : {}),
    selectedProductId: selected.productId,
    packs: catalog.packs.map(pack => ({
      productId: pack.productId,
      name: pack.productId === "pack_mini" ? copy.mini : pack.productId === "pack_regular" ? copy.regular : copy.big,
      quantityLabel: fillPackText(getNativePackCopy(locale, pack.credits).quantity, { count: pack.credits }), priceLabel: pack.priceLabel,
      unitPriceLabel: fillPackText(copy.each, { price: new Intl.NumberFormat(locale, { style: "currency", currency: pack.currency }).format(pack.priceMicros / 1_000_000 / pack.credits) }),
      caption: pack.productId === "pack_mini" ? copy.miniCaption : pack.productId === "pack_regular" ? copy.regularCaption : copy.bigCaption,
      badge: pack.productId === "pack_regular" ? copy.recommended : pack.productId === "pack_big" ? copy.bestValue : undefined,
      offerLabel: pack.offerApplied ? fillPackText(copy.offer, { count: pack.credits, normal: pack.normalCredits, date }) : undefined,
      selected: pack.productId === selected.productId,
    })),
  };
}
