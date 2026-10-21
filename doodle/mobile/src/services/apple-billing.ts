import { PLAY_PACK_IDS } from "../../../src/lib/billing/play-catalog";
import { NATIVE_PRODUCT_ID, type NativeApplePurchaseApi, type NativeBilling, type NativePackCatalog, type NativePlayVerifyResponse, type PlayPackId } from "../contracts/native";
import type { IapModule, IapPurchase } from "./billing";
import { NativeServiceError } from "./errors";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Subscription = { remove(): void };
export class AppleBillingService implements NativeBilling {
  private revision = 0;
  private busy = false;
  private pending: PlayPackId | null = null;
  private active: { productId: PlayPackId; token: string } | null = null;
  private updated: Subscription | null = null;
  private errors: Subscription | null = null;
  private flight: { resolve(grant: NativePlayVerifyResponse): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> } | null = null;
  private recovery: Promise<void> | null = null;
  private readonly processing = new Map<string, Promise<void>>();
  private readonly notified = new Set<string>();
  private readonly listeners = new Set<(grant: NativePlayVerifyResponse) => void>();
  constructor(private readonly options: { iap: IapModule; api: NativeApplePurchaseApi; purchaseTimeoutMs?: number }) {}

  getPendingPack(): PlayPackId | null { return this.pending; }
  subscribeGrants(listener: (grant: NativePlayVerifyResponse) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  resetAccount() {
    this.revision += 1;
    this.reject(new NativeServiceError("purchase_rejected"));
    this.pending = null; this.active = null; this.notified.clear(); this.recovery = null;
  }
  private reject(error: unknown) {
    const flight = this.flight; this.flight = null;
    if (flight) { clearTimeout(flight.timer); flight.reject(error); }
  }
  private listen() {
    this.updated ??= this.options.iap.purchaseUpdatedListener(purchase => {
      void this.handle(purchase).catch(error => {
        if (purchase.productId === this.active?.productId && purchase.appAccountToken === this.active?.token) {
          this.pending = null; this.active = null; this.reject(error);
        }
      });
    });
    this.errors ??= this.options.iap.purchaseErrorListener(() => {
      this.pending = null; this.active = null; this.reject(new NativeServiceError("purchase_rejected"));
    });
  }
  private async connect() {
    if (!await this.options.iap.initConnection()) throw new NativeServiceError("billing_unavailable");
    this.listen();
  }
  async preparePacks(): Promise<NativePackCatalog> {
    const catalog = await this.options.api.getAppleCatalog();
    await this.connect();
    const products = await this.options.iap.fetchProducts({ skus: [...PLAY_PACK_IDS], type: "in-app" });
    const packs = catalog.packs.map(pack => {
      const product = products?.find(product => product.id === pack.productId && product.type === "in-app");
      if (!product?.displayPrice || typeof product.price !== "number" || !Number.isFinite(product.price) || product.price <= 0 || !/^[A-Z]{3}$/.test(product.currency ?? "")) throw new NativeServiceError("billing_unavailable");
      return { ...pack, priceLabel: product.displayPrice, price: product.price, priceMicros: Math.round(product.price * 1_000_000), currency: product.currency! };
    });
    return { ...catalog, packs };
  }
  async buyPack(productId: PlayPackId, expectedCredits: number): Promise<NativePlayVerifyResponse> {
    if (this.busy || this.flight || this.pending) throw new NativeServiceError("purchase_pending");
    this.busy = true;
    const revision = this.revision;
    try {
      const catalog = await this.preparePacks();
      if (revision !== this.revision) throw new NativeServiceError("purchase_rejected");
      if (catalog.packs.find(pack => pack.productId === productId)?.credits !== expectedCredits) throw new NativeServiceError("offer_changed");
      await this.recoverPacks();
      if (revision !== this.revision) throw new NativeServiceError("purchase_rejected");
      if (this.pending) throw new NativeServiceError("purchase_pending");
      const intent = await this.options.api.createAppleIntent(productId, expectedCredits);
      if (revision !== this.revision) throw new NativeServiceError("purchase_rejected");
      if (!UUID.test(intent.appAccountToken) || intent.productId !== productId || intent.credits !== expectedCredits) throw new NativeServiceError("billing_unavailable");
      this.active = { productId, token: intent.appAccountToken }; this.pending = productId;
      const result = new Promise<NativePlayVerifyResponse>((resolve, reject) => {
        const timer = setTimeout(() => { this.flight = null; reject(new NativeServiceError("purchase_pending")); }, this.options.purchaseTimeoutMs ?? 120_000);
        this.flight = { resolve, reject, timer };
      });
      void result.catch(() => undefined);
      // StoreKit delivers through listeners. Never auto-finish before our server grants credits.
      void this.options.iap.requestPurchase({ type: "in-app", request: { apple: { sku: productId, appAccountToken: intent.appAccountToken, andDangerouslyFinishTransactionAutomatically: false } } }).catch(() => {
        if (revision !== this.revision) return;
        this.pending = null; this.active = null; this.reject(new NativeServiceError("purchase_rejected"));
      });
      return await result;
    } finally { this.busy = false; }
  }
  private handle(purchase: IapPurchase): Promise<void> {
    if (!purchase.id || !/^\d{1,32}$/.test(purchase.id) || !PLAY_PACK_IDS.includes(purchase.productId as PlayPackId) || !purchase.appAccountToken || !UUID.test(purchase.appAccountToken)) return Promise.resolve();
    const id = purchase.id;
    const revision = this.revision;
    const processingKey = `${revision}:${id}`;
    const existing = this.processing.get(processingKey); if (existing) return existing;
    const work = this.deliver(purchase, revision).finally(() => { this.processing.delete(processingKey); });
    this.processing.set(processingKey, work); return work;
  }
  private async deliver(purchase: IapPurchase, revision: number) {
    if (purchase.purchaseState === "pending") { this.pending = purchase.productId as PlayPackId; this.reject(new NativeServiceError("purchase_pending")); return; }
    if (purchase.purchaseState !== "purchased") return;
    const grant = await this.options.api.verifyApplePurchase(purchase.id!);
    if (revision !== this.revision) return;
    const allowed = purchase.productId === "pack_mini" ? [6] : purchase.productId === "pack_regular" ? [20, 25] : [60];
    if (!["granted", "already_granted"].includes(grant.status) || !Number.isSafeInteger(grant.balance) || grant.balance < 0 ||
      grant.productId !== purchase.productId || !allowed.includes(grant.creditsGranted ?? 0) ||
      grant.offerApplied !== (purchase.productId === "pack_regular" && grant.creditsGranted === 25) ||
      grant.checkoutReference?.toLowerCase() !== purchase.appAccountToken?.toLowerCase()) throw new NativeServiceError("purchase_rejected");
    // Delivery survives an interrupted finish. Recovery repeats verification and finish safely.
    try { await this.options.iap.finishTransaction({ purchase, isConsumable: true }); } catch { /* Unfinished transaction remains recoverable. */ }
    if (revision !== this.revision) return;
    if (!this.notified.has(purchase.id!)) {
      this.notified.add(purchase.id!);
      if (this.notified.size > 256) this.notified.delete(this.notified.values().next().value!);
      for (const listener of this.listeners) { try { listener(grant); } catch { /* UI does not alter delivery. */ } }
    }
    if (this.pending === purchase.productId) this.pending = null;
    const active = this.active;
    if (active && active.productId === purchase.productId && active.token.toLowerCase() === purchase.appAccountToken?.toLowerCase()) {
      const flight = this.flight; this.flight = null; this.active = null;
      if (flight) { clearTimeout(flight.timer); flight.resolve(grant); }
    }
  }
  async recoverPacks(): Promise<void> {
    if (this.recovery) return this.recovery;
    const revision = this.revision;
    const recovering = (async () => {
      await this.options.api.getAppleCatalog(); await this.connect();
      if (revision !== this.revision) return;
      if (!this.options.iap.getPendingTransactionsIOS) throw new NativeServiceError("billing_unavailable");
      const purchases = await this.options.iap.getPendingTransactionsIOS();
      for (const purchase of purchases) {
        if (revision !== this.revision) return;
        try { await this.handle(purchase); } catch { /* Retry later under the owning signed-in account. */ }
      }
    })();
    this.recovery = recovering;
    try { await recovering; } finally { if (this.recovery === recovering) this.recovery = null; }
  }
  async recoverPending() { return this.recoverPacks(); }
  async prepare(): Promise<{ productId: typeof NATIVE_PRODUCT_ID; priceLabel: string }> { throw new NativeServiceError("billing_unavailable"); }
  async buy(): Promise<void> { throw new NativeServiceError("billing_unavailable"); }
  async dispose() { this.resetAccount(); this.updated?.remove(); this.errors?.remove(); this.updated = null; this.errors = null; await this.options.iap.endConnection(); }
}
