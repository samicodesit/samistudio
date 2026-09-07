export const PLAY_PRODUCT = "doodle_credits_10";
const PLAY_METHOD = "https://play.google.com/billing";
const RUNTIME_KEY = "doodle:play-runtime";

export type PlayProduct = { itemId: string; price: { currency: string; value: string } };
export type PlayService = {
  getDetails(ids: string[]): Promise<PlayProduct[]>;
  listPurchases(): Promise<Array<{ itemId: string; purchaseToken: string }>>;
};
export type PreparedPlayPurchase = { service: PlayService; product: PlayProduct; obfuscatedAccountId: string };
type PlayWindow = Window & { getDigitalGoodsService?: (method: string) => Promise<PlayService> };

// This is only a checkout-routing hint. The server never uses it to grant credits.
export function isPlayRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const marked = new URLSearchParams(window.location.search).get("runtime") === "play";
  try {
    if (marked) sessionStorage.setItem(RUNTIME_KEY, "1");
    return marked || sessionStorage.getItem(RUNTIME_KEY) === "1" || typeof (window as PlayWindow).getDigitalGoodsService === "function";
  } catch { return marked || typeof (window as PlayWindow).getDigitalGoodsService === "function"; }
}

export async function preparePlayPurchase(): Promise<PreparedPlayPurchase> {
  const getService = (window as PlayWindow).getDigitalGoodsService;
  if (!getService || typeof window.PaymentRequest !== "function") throw new Error("play_unavailable");
  const response = await fetch("/api/play/config", { cache: "no-store" });
  if (!response.ok) throw new Error("play_unavailable");
  const config = await response.json() as { enabled?: boolean; productId?: string; obfuscatedAccountId?: string };
  if (config.enabled !== true || config.productId !== PLAY_PRODUCT || !/^[a-f0-9]{64}$/.test(config.obfuscatedAccountId ?? "")) throw new Error("play_unavailable");
  const service = await getService.call(window, PLAY_METHOD);
  const details = await service.getDetails([PLAY_PRODUCT]);
  const product = details.find((item) => item.itemId === PLAY_PRODUCT);
  if (!product || !/^[A-Z]{3}$/.test(product.price.currency) || !/^\d+(\.\d+)?$/.test(product.price.value) || !Number.isFinite(Number(product.price.value))) throw new Error("play_unavailable");
  return { service, product, obfuscatedAccountId: config.obfuscatedAccountId! };
}

async function verifyPlayPurchase(purchaseToken: string): Promise<void> {
  if (!purchaseToken || purchaseToken.length > 4096) throw new Error("play_invalid_purchase");
  const response = await fetch("/api/play/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaseToken, productId: PLAY_PRODUCT }),
  });
  if (!response.ok) throw new Error("play_verification_failed");
}

// Construct/show before the first await to preserve the button's user activation.
export async function purchasePlayPack(prepared: PreparedPlayPurchase): Promise<void> {
  const request = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku: PLAY_PRODUCT, obfuscatedAccountId: prepared.obfuscatedAccountId } }], {
    total: { label: "Doodle", amount: prepared.product.price },
  });
  const payment = await request.show();
  try {
    const token = (payment.details as { purchaseToken?: unknown }).purchaseToken;
    if (typeof token !== "string") throw new Error("play_invalid_purchase");
    await verifyPlayPurchase(token);
  } catch (error) {
    await payment.complete("fail").catch(() => undefined);
    throw error;
  }
  // The backend owns grant and consumption, including granted_consume_pending.
  await payment.complete("success").catch(() => undefined);
}

export async function recoverPlayPurchases(service: PlayService): Promise<{ recovered: number; failed: number }> {
  const purchases = await service.listPurchases();
  let recovered = 0;
  let failed = 0;
  for (const purchase of purchases) {
    if (purchase.itemId !== PLAY_PRODUCT) continue;
    try { await verifyPlayPurchase(purchase.purchaseToken); recovered++; }
    catch { failed++; }
  }
  return { recovered, failed };
}
