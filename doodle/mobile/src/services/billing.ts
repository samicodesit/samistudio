import type { NativePlayConfig, NativePlayVerifyResponse } from "../contracts/native";
import { NATIVE_PRODUCT_ID, type NativeBilling, type NativePurchaseApi } from "../contracts/native";
import { NativeServiceError } from "./errors";

export type IapPurchase = {
  id?: string;
  productId?: string;
  purchaseState?: string;
  purchaseToken?: string | null;
  obfuscatedAccountIdAndroid?: string | null;
};

export interface IapModule {
  initConnection(): Promise<boolean>;
  fetchProducts(input: { skus: string[]; type: "in-app" }): Promise<readonly { id?: string; type?: string; displayPrice?: string }[] | null>;
  purchaseUpdatedListener(listener: (purchase: IapPurchase) => void): { remove(): void };
  purchaseErrorListener(listener: (error: unknown) => void): { remove(): void };
  requestPurchase(input: { type: "in-app"; request: { google: { skus: string[]; obfuscatedAccountId: string } } }): Promise<unknown>;
  getAvailablePurchases(): Promise<readonly IapPurchase[]>;
  finishTransaction(input: { purchase: IapPurchase; isConsumable: boolean }): Promise<void>;
  endConnection(): Promise<void>;
}

export interface NativeBillingOptions {
  iap: IapModule;
  api: NativePurchaseApi;
  platform?: "android" | "ios";
  purchaseTimeoutMs?: number;
}

type PreparedProduct = { productId: typeof NATIVE_PRODUCT_ID; priceLabel: string; binding: string };

const ACCOUNT_BINDING_PATTERN = /^[a-f0-9]{64}$/;

export class NativeBillingService implements NativeBilling {
  private readonly platform: "android" | "ios";
  private readonly purchaseTimeoutMs: number;
  private prepared: PreparedProduct | null = null;
  private updatedSubscription: { remove(): void } | null = null;
  private errorSubscription: { remove(): void } | null = null;
  private inFlight: { resolve(): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> } | null = null;
  private readonly processing = new Set<string>();
  private recoveryInFlight: Promise<void> | null = null;

  constructor(private readonly options: NativeBillingOptions) {
    this.platform = options.platform ?? "android";
    this.purchaseTimeoutMs = options.purchaseTimeoutMs ?? 120_000;
  }

  async prepare(): Promise<{ productId: typeof NATIVE_PRODUCT_ID; priceLabel: string }> {
    if (this.platform !== "android") throw new NativeServiceError("billing_unavailable");
    if (this.prepared) return { productId: this.prepared.productId, priceLabel: this.prepared.priceLabel };

    try {
      await this.options.iap.initConnection();
      const products = await this.options.iap.fetchProducts({ skus: [NATIVE_PRODUCT_ID], type: "in-app" });
      const product = products?.find((candidate) => candidate.id === NATIVE_PRODUCT_ID && candidate.type === "in-app");
      if (!product || typeof product.displayPrice !== "string" || product.displayPrice.length === 0) {
        throw new NativeServiceError("billing_unavailable");
      }
      const config = await this.options.api.getPlayConfig();
      if (!validPlayConfig(config)) throw new NativeServiceError("billing_unavailable");
      this.prepared = { productId: NATIVE_PRODUCT_ID, priceLabel: product.displayPrice, binding: config.obfuscatedAccountId };
      this.updatedSubscription = this.options.iap.purchaseUpdatedListener((purchase) => {
        void this.handlePurchase(purchase).catch((error) => this.rejectInFlight(error));
      });
      this.errorSubscription = this.options.iap.purchaseErrorListener((error) => {
        void error;
        this.rejectInFlight(new NativeServiceError("purchase_rejected"));
      });
      return { productId: NATIVE_PRODUCT_ID, priceLabel: product.displayPrice };
    } catch (error) {
      if (error instanceof NativeServiceError) throw error;
      throw new NativeServiceError("billing_unavailable");
    }
  }

  async buy(): Promise<void> {
    if (!this.prepared) throw new NativeServiceError("billing_unavailable");
    if (this.inFlight) throw new NativeServiceError("purchase_pending");

    const result = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inFlight = null;
        reject(new NativeServiceError("purchase_pending"));
      }, this.purchaseTimeoutMs);
      this.inFlight = { resolve, reject, timer };
    });

    try {
      await this.options.iap.requestPurchase({
        type: "in-app",
        request: { google: { skus: [NATIVE_PRODUCT_ID], obfuscatedAccountId: this.prepared.binding } },
      });
    } catch {
      this.rejectInFlight(new NativeServiceError("purchase_rejected"));
    }
    return result;
  }

  async recoverPending(): Promise<void> {
    if (!this.prepared) throw new NativeServiceError("billing_unavailable");
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
    let purchases: readonly IapPurchase[];
    try {
      purchases = await this.options.iap.getAvailablePurchases();
    } catch {
      throw new NativeServiceError("billing_unavailable");
    }
    for (const purchase of purchases) {
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
    this.prepared = null;
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

  private resolveInFlight(): void {
    const pending = this.inFlight;
    if (!pending) return;
    this.inFlight = null;
    clearTimeout(pending.timer);
    pending.resolve();
  }

  private async handlePurchase(purchase: IapPurchase): Promise<void> {
    if (!this.prepared || purchase.productId !== NATIVE_PRODUCT_ID) return;
    const transactionId = purchase.id ?? `${purchase.productId}:${purchase.purchaseToken ?? "missing"}`;
    if (this.processing.has(transactionId)) return;
    this.processing.add(transactionId);
    try {
      if (purchase.purchaseState !== "purchased") throw new NativeServiceError("purchase_pending");
      // Some Play Billing callbacks omit the optional obfuscated account ID.
      // The server still verifies the receipt against the bearer account. An
      // explicit callback value that disagrees with the prepared binding is
      // unsafe and is rejected before any server grant request.
      if (!purchase.purchaseToken || (purchase.obfuscatedAccountIdAndroid != null && purchase.obfuscatedAccountIdAndroid !== this.prepared.binding)) {
        throw new NativeServiceError("purchase_rejected");
      }
      const verified = await this.options.api.verifyPlayPurchase({ productId: NATIVE_PRODUCT_ID, purchaseToken: purchase.purchaseToken });
      if (!isGrantStatus(verified.status)) throw new NativeServiceError("purchase_pending");
      if (verified.status === "granted_consume_pending") throw new NativeServiceError("purchase_pending");
      await this.options.iap.finishTransaction({ purchase, isConsumable: true });
      this.resolveInFlight();
    } finally {
      this.processing.delete(transactionId);
    }
  }
}

function validPlayConfig(value: NativePlayConfig): value is NativePlayConfig {
  return value.enabled === true && value.productId === NATIVE_PRODUCT_ID && ACCOUNT_BINDING_PATTERN.test(value.obfuscatedAccountId);
}

function isGrantStatus(value: NativePlayVerifyResponse["status"]): boolean {
  return value === "granted" || value === "already_granted" || value === "granted_consume_pending";
}
