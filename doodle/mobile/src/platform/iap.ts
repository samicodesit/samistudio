import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from "expo-iap";
import type { IapModule } from "../services/billing";

export const expoIapModule: IapModule = {
  initConnection,
  fetchProducts: async (input) => {
    const products = await fetchProducts(input);
    return (products ?? []) as readonly { id?: string; type?: string; displayPrice?: string }[];
  },
  purchaseUpdatedListener: (listener) => purchaseUpdatedListener(listener as (purchase: Purchase) => void),
  purchaseErrorListener,
  requestPurchase: (input) => requestPurchase(input),
  getAvailablePurchases: async () => getAvailablePurchases(),
  finishTransaction: async (input) => {
    await finishTransaction(input as unknown as Parameters<typeof finishTransaction>[0]);
  },
  endConnection: async () => {
    await endConnection();
  },
};
