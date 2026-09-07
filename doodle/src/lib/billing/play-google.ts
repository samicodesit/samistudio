import "server-only";

import { GoogleAuth } from "google-auth-library";
import type { PlayBillingConfig } from "./play-config";
import type { PlayPublisherClient, ProductPurchaseV2 } from "./play-purchase";

const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";

export function createPlayPublisherClient(config: PlayBillingConfig): PlayPublisherClient {
  const auth = new GoogleAuth({ credentials: config.credentials, scopes: [ANDROID_PUBLISHER_SCOPE] });
  return {
    async getProductPurchase(purchaseToken) {
      const client = await auth.getClient();
      const response = await client.request<ProductPurchaseV2>({
        method: "GET",
        timeout: 15_000,
        url: `${API_BASE}/applications/${encodeURIComponent(config.packageName)}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      });
      return response.data;
    },
    async consumeProductPurchase(productId, purchaseToken) {
      const client = await auth.getClient();
      await client.request({
        method: "POST",
        timeout: 15_000,
        url: `${API_BASE}/applications/${encodeURIComponent(config.packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`,
      });
    },
  };
}
