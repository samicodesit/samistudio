import { PLAY_PACK_IDS } from "../../../src/lib/billing/play-catalog";
import type { NativePackCatalog, PlayPackId } from "../contracts/native";
import type { NativePlayConfig, NativePlayVerifyResponse } from "../contracts/native";
import { NATIVE_PRODUCT_ID, type NativeBilling, type NativePurchaseApi } from "../contracts/native";
import { NativeServiceError } from "./errors";
import type { NativeDiagnosticsSink } from "./diagnostics";

export type IapProduct = {id?:string;type?:string;displayPrice?:string;price?:number|null;currency?:string};
export type IapPurchase = {
  id?: string;
  productId?: string;
  purchaseState?: string;
  purchaseToken?: string | null;
  obfuscatedAccountIdAndroid?: string | null;
  obfuscatedProfileIdAndroid?: string | null;
  appAccountToken?: string | null;
};

export interface IapModule {
  initConnection(): Promise<boolean>;
  fetchProducts(input: { skus: string[]; type: "in-app" }): Promise<readonly IapProduct[] | null>;
  purchaseUpdatedListener(listener: (purchase: IapPurchase) => void): { remove(): void };
  purchaseErrorListener(listener: (error: unknown) => void): { remove(): void };
  requestPurchase(input: { type: "in-app"; request: { google: { skus: string[]; obfuscatedAccountId: string; obfuscatedProfileId?: string } } | { apple: { sku: string; appAccountToken: string; andDangerouslyFinishTransactionAutomatically: false } } }): Promise<unknown>;
  getAvailablePurchases(): Promise<readonly IapPurchase[]>;
  getPendingTransactionsIOS?(): Promise<readonly IapPurchase[]>;
  finishTransaction(input: { purchase: IapPurchase; isConsumable: boolean }): Promise<void>;
  endConnection(): Promise<void>;
}

export interface NativeBillingOptions {
  iap: IapModule;
  api: NativePurchaseApi;
  platform?: "android" | "ios";
  purchaseTimeoutMs?: number;
  diagnostics?: NativeDiagnosticsSink;
}

type PreparedProduct = { productId: typeof NATIVE_PRODUCT_ID; priceLabel: string; binding: string };

const ACCOUNT_BINDING_PATTERN = /^[a-f0-9]{64}$/;

export class NativeBillingService implements NativeBilling {
  private readonly platform: "android" | "ios";
  private readonly purchaseTimeoutMs: number;
  private prepared: PreparedProduct | null = null;
  private packCatalog: NativePackCatalog | null = null;
  private packCheckoutBusy = false;
  private accountRevision = 0;
  private readonly pendingPacks = new Set<PlayPackId>();
  private activePack: {productId:string;reference:string} | null = null;
  private lastGrant: NativePlayVerifyResponse | null = null;
  private readonly grantListeners = new Set<(grant: NativePlayVerifyResponse) => void>();
  private readonly notifiedTransactions = new Set<string>();
  private updatedSubscription: { remove(): void } | null = null;
  private errorSubscription: { remove(): void } | null = null;
  private inFlight: { resolve(): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> } | null = null;
  private readonly processing = new Set<string>();
  private recoveryInFlight: Promise<void> | null = null;
  private readonly diagnostics?: NativeDiagnosticsSink;

  constructor(private readonly options: NativeBillingOptions) {
    this.platform = options.platform ?? "android";
    this.purchaseTimeoutMs = options.purchaseTimeoutMs ?? 120_000;
    this.diagnostics = options.diagnostics;
  }

  getPendingPack(): PlayPackId | null { return this.pendingPacks.values().next().value ?? null; }
  resetAccount(): void {
    this.accountRevision += 1;
    this.rejectInFlight(new NativeServiceError("purchase_rejected"));
    this.prepared = null; this.activePack = null; this.lastGrant = null;
    this.pendingPacks.clear(); this.notifiedTransactions.clear();
    this.recoveryInFlight = null;
  }

  subscribeGrants(listener: (grant: NativePlayVerifyResponse) => void): () => void {
    this.grantListeners.add(listener);
    return () => { this.grantListeners.delete(listener); };
  }
  private notifyGrant(transactionId: string, grant: NativePlayVerifyResponse): void {
    if (this.notifiedTransactions.has(transactionId)) return;
    this.notifiedTransactions.add(transactionId);
    if (this.notifiedTransactions.size > 256) this.notifiedTransactions.delete(this.notifiedTransactions.values().next().value!);
    for (const listener of this.grantListeners) {
      try { listener(grant); } catch { /* UI feedback never alters fulfillment. */ }
    }
  }

  async preparePacks():Promise<NativePackCatalog>{
    if(this.platform!=="android"||!this.options.api.getPlayCatalog)throw new NativeServiceError("billing_unavailable");
    const catalog=await this.options.api.getPlayCatalog();
    await this.options.iap.initConnection();
    const products=await this.options.iap.fetchProducts({skus:[...PLAY_PACK_IDS],type:"in-app"});
    const packs=catalog.packs.map(pack=>{
      const product=products?.find(p=>p.id===pack.productId&&p.type==="in-app");
      if(!product||!product.displayPrice||typeof product.price!=="number"||!Number.isFinite(product.price)||product.price<=0||!/^[A-Z]{3}$/.test(product.currency??""))throw new NativeServiceError("billing_unavailable");
      return {...pack,priceLabel:product.displayPrice,price:product.price,priceMicros:Math.round(product.price*1000000),currency:product.currency!};
    });
    this.packCatalog={...catalog,packs};
    this.listen();
    return this.packCatalog;
  }
  private listen():void{
    if(!this.updatedSubscription)this.updatedSubscription=this.options.iap.purchaseUpdatedListener(purchase=>{
      void this.handlePurchase(purchase).catch(error=>this.rejectPurchaseFailure(purchase,error));
    });
    if(!this.errorSubscription)this.errorSubscription=this.options.iap.purchaseErrorListener(()=>this.rejectInFlight(new NativeServiceError("purchase_rejected")));
  }
  async buyPack(productId:PlayPackId,expectedCredits:number):Promise<NativePlayVerifyResponse>{
    if(this.inFlight || this.packCheckoutBusy || this.pendingPacks.size)throw new NativeServiceError("purchase_pending");
    this.packCheckoutBusy = true;
    try { return await this.buyPackInternal(productId, expectedCredits); }
    finally { this.packCheckoutBusy = false; }
  }
  private async buyPackInternal(productId:PlayPackId,expectedCredits:number):Promise<NativePlayVerifyResponse>{
    const revision = this.accountRevision;
    const catalog=await this.preparePacks();
    if (revision !== this.accountRevision) throw new NativeServiceError("purchase_rejected");
    const pack=catalog.packs.find(p=>p.productId===productId);
    if(!pack||pack.credits!==expectedCredits)throw new NativeServiceError("offer_changed");
    if(!this.options.api.createPlayIntent)throw new NativeServiceError("billing_unavailable");
    const intent=await this.options.api.createPlayIntent(productId,expectedCredits);
    if (revision !== this.accountRevision) throw new NativeServiceError("purchase_rejected");
    this.prepared={productId:NATIVE_PRODUCT_ID,priceLabel:pack.priceLabel,binding:intent.obfuscatedAccountId};
    // Query Play before launch, including pending payments recovered after restart.
    await this.recoverPending();
    if (revision !== this.accountRevision) throw new NativeServiceError("purchase_rejected");
    if (this.pendingPacks.size) throw new NativeServiceError("purchase_pending");
    this.activePack={productId,reference:intent.obfuscatedProfileId};
    this.lastGrant=null;
    this.pendingPacks.add(productId);
    const result=new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{this.inFlight=null;reject(new NativeServiceError("purchase_pending"));},this.purchaseTimeoutMs);
      this.inFlight={resolve,reject,timer};
    });
    // The callback can reject before requestPurchase's own promise settles.
    // Attach a handler immediately while retaining the rejection for await.
    void result.catch(() => undefined);
    try{
      await this.options.iap.requestPurchase({type:"in-app",request:{google:{skus:[productId],obfuscatedAccountId:intent.obfuscatedAccountId,obfuscatedProfileId:intent.obfuscatedProfileId}}});
    }catch{this.pendingPacks.delete(productId); this.activePack = null; this.rejectInFlight(new NativeServiceError("purchase_rejected"));}
    try {
      // Google checkout can remain open beyond our callback timeout. A
      // correlated server-verified grant takes precedence over that timeout.
      if (!this.lastGrant) await result;
    } catch (error) {
      if (!(error instanceof NativeServiceError) || error.code !== "purchase_pending") { this.pendingPacks.delete(productId); this.activePack = null; }
      throw error;
    }
    if (revision !== this.accountRevision) throw new NativeServiceError("purchase_rejected");
    if(!this.lastGrant)throw new NativeServiceError("purchase_pending");
    return this.lastGrant;
  }
  async recoverPacks():Promise<void>{
    const revision = this.accountRevision;
    const config=await this.readPlayConfig();
    if (revision !== this.accountRevision) return;
    if(!validPlayConfig(config))throw new NativeServiceError("billing_unavailable");
    await this.options.iap.initConnection();
    if (revision !== this.accountRevision) return;
    this.listen();
    this.prepared={productId:NATIVE_PRODUCT_ID,priceLabel:"",binding:config.obfuscatedAccountId};
    await this.recoverPending();
  }

  async prepare(): Promise<{ productId: typeof NATIVE_PRODUCT_ID; priceLabel: string }> {
    const startedAt = Date.now();
    if (this.platform !== "android") {
      this.record("billing_prepare", "billing_unavailable", startedAt);
      throw new NativeServiceError("billing_unavailable");
    }
    if (this.prepared) {
      const config = await this.readPlayConfig();
      if (!validPlayConfig(config)) {
        this.record("billing_prepare", "billing_unavailable", startedAt);
        throw new NativeServiceError("billing_unavailable");
      }
      this.prepared = { ...this.prepared, binding: config.obfuscatedAccountId };
      return { productId: this.prepared.productId, priceLabel: this.prepared.priceLabel };
    }

    let product: { id?: string; type?: string; displayPrice?: string } | undefined;
    try {
      await this.options.iap.initConnection();
      const products = await this.options.iap.fetchProducts({ skus: [NATIVE_PRODUCT_ID], type: "in-app" });
      product = products?.find((candidate) => candidate.id === NATIVE_PRODUCT_ID && candidate.type === "in-app");
      if (!product || typeof product.displayPrice !== "string" || product.displayPrice.length === 0) {
        throw new NativeServiceError("billing_unavailable");
      }
    } catch (error) {
      this.record("billing_prepare", error instanceof NativeServiceError ? error.code : "billing_unavailable", startedAt, providerCode(error));
      if (error instanceof NativeServiceError) throw error;
      throw new NativeServiceError("billing_unavailable");
    }
    const config = await this.readPlayConfig();
    if (!validPlayConfig(config)) {
      this.record("billing_prepare", "billing_unavailable", startedAt);
      throw new NativeServiceError("billing_unavailable");
    }
    try {
      if (!product || typeof product.displayPrice !== "string") throw new NativeServiceError("billing_unavailable");
      this.prepared = { productId: NATIVE_PRODUCT_ID, priceLabel: product.displayPrice, binding: config.obfuscatedAccountId };
      this.updatedSubscription = this.options.iap.purchaseUpdatedListener((purchase) => {
        void this.handlePurchase(purchase).catch((error) => this.rejectPurchaseFailure(purchase,error));
      });
      this.errorSubscription = this.options.iap.purchaseErrorListener((error) => {
        this.record("billing_purchase", "purchase_rejected", Date.now(), providerCode(error));
        this.rejectInFlight(new NativeServiceError("purchase_rejected"));
      });
      return { productId: NATIVE_PRODUCT_ID, priceLabel: product.displayPrice };
    } catch (error) {
      this.record("billing_prepare", error instanceof NativeServiceError ? error.code : "billing_unavailable", startedAt, providerCode(error));
      if (error instanceof NativeServiceError) throw error;
      throw new NativeServiceError("billing_unavailable");
    }
  }

  async buy(): Promise<void> {
    const startedAt = Date.now();
    if (!this.prepared) {
      this.record("billing_purchase", "billing_unavailable", startedAt);
      throw new NativeServiceError("billing_unavailable");
    }
    if (this.inFlight || this.packCheckoutBusy || this.pendingPacks.size) {
      this.record("billing_purchase", "purchase_pending", startedAt);
      throw new NativeServiceError("purchase_pending");
    }

    const result = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inFlight = null;
        this.record("billing_purchase", "purchase_pending", startedAt);
        reject(new NativeServiceError("purchase_pending"));
      }, this.purchaseTimeoutMs);
      this.inFlight = { resolve, reject, timer };
    });
    void result.catch(() => undefined);

    try {
      await this.options.iap.requestPurchase({
        type: "in-app",
        request: { google: { skus: [NATIVE_PRODUCT_ID], obfuscatedAccountId: this.prepared.binding } },
      });
    } catch (error) {
      this.record("billing_purchase", "purchase_rejected", startedAt, providerCode(error));
      this.rejectInFlight(new NativeServiceError("purchase_rejected"));
    }
    return result;
  }

  private async readPlayConfig(): Promise<NativePlayConfig> {
    try {
      return await this.options.api.getPlayConfig();
    } catch (error) {
      if (error instanceof NativeServiceError) throw error;
      throw new NativeServiceError("billing_unavailable");
    }
  }

  async recoverPending(): Promise<void> {
    const startedAt = Date.now();
    if (!this.prepared) {
      this.record("billing_recover", "billing_unavailable", startedAt);
      throw new NativeServiceError("billing_unavailable");
    }
    if (this.recoveryInFlight) return this.recoveryInFlight;
    const recovery = this.recoverPendingInternal();
    this.recoveryInFlight = recovery;
    try {
      await recovery;
    } finally {
      if (this.recoveryInFlight === recovery) this.recoveryInFlight = null;
    }
  }

  private async recoverPendingInternal(): Promise<void> {
    const startedAt = Date.now();
    const revision = this.accountRevision;
    let purchases: readonly IapPurchase[];
    try {
      purchases = await this.options.iap.getAvailablePurchases();
    } catch (error) {
      this.record("billing_recover", "billing_unavailable", startedAt, providerCode(error));
      throw new NativeServiceError("billing_unavailable");
    }
    if (revision !== this.accountRevision) return;
    if (!this.inFlight && !this.packCheckoutBusy) {
      for (const pack of this.pendingPacks) {
        if (!purchases.some(p => p.productId === pack && (p.obfuscatedAccountIdAndroid == null || p.obfuscatedAccountIdAndroid === this.prepared?.binding))) this.pendingPacks.delete(pack);
      }
      if (this.activePack && !this.pendingPacks.has(this.activePack.productId as PlayPackId)) this.activePack = null;
    }
    for (const purchase of purchases) {
      if (revision !== this.accountRevision) return;
      try {
        await this.handlePurchase(purchase);
      } catch {
        // Leave rejected, pending, foreign, or unverifiable purchases in the store.
      }
    }
  }

  async dispose(): Promise<void> {
    this.updatedSubscription?.remove();
    this.errorSubscription?.remove();
    this.updatedSubscription = null;
    this.errorSubscription = null;
    this.rejectInFlight(new NativeServiceError("purchase_pending"));
    this.resetAccount();
    this.packCatalog = null;
    this.activePack = null;
    this.lastGrant = null;
    this.grantListeners.clear();
    this.notifiedTransactions.clear();
    this.recoveryInFlight = null;
    try {
      await this.options.iap.endConnection();
    } catch {
      // The connection is already being disposed. Nothing else can be safely done here.
    }
  }

  private rejectInFlight(error: unknown): void {
    const pending = this.inFlight;
    if (!pending) return;
    this.inFlight = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private rejectPurchaseFailure(purchase: IapPurchase, error: unknown): void {
    if (this.activePack && (purchase.productId !== this.activePack.productId ||
      purchase.obfuscatedProfileIdAndroid !== this.activePack.reference)) return;
    // An omitted profile cannot identify an unverified callback. Leave it for
    // recovery; the active checkout waits for a verified match or its timeout.
    this.rejectInFlight(error);
  }

  private resolveInFlight(): void {
    const pending = this.inFlight;
    if (!pending) return;
    this.inFlight = null;
    clearTimeout(pending.timer);
    pending.resolve();
  }

  private async handlePurchase(purchase: IapPurchase): Promise<void> {
    if (!this.prepared || !purchase.productId || ![NATIVE_PRODUCT_ID,...PLAY_PACK_IDS].includes(purchase.productId as typeof NATIVE_PRODUCT_ID)) return;
    const transactionId = purchase.id ?? `${purchase.productId}:${purchase.purchaseToken ?? "missing"}`;
    if (this.processing.has(transactionId)) return;
    this.processing.add(transactionId);
    const revision = this.accountRevision;
    try {
      if (purchase.obfuscatedAccountIdAndroid != null && purchase.obfuscatedAccountIdAndroid !== this.prepared.binding) {
        this.record("billing_purchase", "purchase_rejected", Date.now());
        throw new NativeServiceError("purchase_rejected");
      }
      if (purchase.purchaseState !== "purchased") {
        if (PLAY_PACK_IDS.includes(purchase.productId as PlayPackId)) this.pendingPacks.add(purchase.productId as PlayPackId);
        this.record("billing_purchase", "purchase_pending", Date.now());
        throw new NativeServiceError("purchase_pending");
      }
      // Some Play Billing callbacks omit the optional obfuscated account ID.
      // The server still verifies the receipt against the bearer account. An
      // explicit callback value that disagrees with the prepared binding is
      // unsafe and is rejected before any server grant request.
      if (!purchase.purchaseToken || (purchase.obfuscatedAccountIdAndroid != null && purchase.obfuscatedAccountIdAndroid !== this.prepared.binding)) {
        this.record("billing_purchase", "purchase_rejected", Date.now());
        throw new NativeServiceError("purchase_rejected");
      }
      const verified: NativePlayVerifyResponse = await this.options.api.verifyPlayPurchase({ productId: purchase.productId, purchaseToken: purchase.purchaseToken });
      if (revision !== this.accountRevision) return;
      if (!isGrantStatus(verified.status)) {
        this.record("billing_verify", "purchase_pending", Date.now());
        throw new NativeServiceError("purchase_pending");
      }
      this.pendingPacks.delete(purchase.productId as PlayPackId);
      this.notifyGrant(transactionId, verified);
      const matchesActivePack = !!this.activePack && verified.productId === this.activePack.productId && verified.checkoutReference === this.activePack.reference;
      if (verified.status === "granted_consume_pending") {
        this.record("billing_consume", "purchase_pending", Date.now());
        // The server has already delivered these credits. A matched pack can
        // return to the drawing while server/store recovery retries consumption.
        // Preserve the older product's existing recovery behavior.
        if (!matchesActivePack) throw new NativeServiceError("purchase_pending");
      }
      // The backend owns consumption. The device must not consume it again.
      if(!this.activePack||matchesActivePack){
        this.lastGrant=verified;
        this.resolveInFlight();
        this.activePack = null;
      }
    } finally {
      this.processing.delete(transactionId);
    }
  }

  private record(stage: "billing_prepare" | "billing_purchase" | "billing_verify" | "billing_consume" | "billing_recover", code: unknown, startedAt: number, providerCodeValue?: unknown): void {
    try {
      void Promise.resolve(this.diagnostics?.record({ operation: "billing", stage, code, providerCode: providerCodeValue, durationMs: boundedDuration(Date.now() - startedAt) })).catch(() => undefined);
    } catch {
      // Diagnostics must never change the billing result.
    }
  }
}

function validPlayConfig(value: NativePlayConfig): value is NativePlayConfig {
  return value.enabled === true && value.productId === NATIVE_PRODUCT_ID && ACCOUNT_BINDING_PATTERN.test(value.obfuscatedAccountId);
}

function isGrantStatus(value: NativePlayVerifyResponse["status"]): boolean {
  return value === "granted" || value === "already_granted" || value === "granted_consume_pending";
}

function providerCode(error: unknown): unknown {
  return error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
}

function boundedDuration(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 190_000) : 0;
}
