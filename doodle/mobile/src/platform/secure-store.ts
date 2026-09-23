import * as SecureStore from "expo-secure-store";
import type { NativeSecureStorage } from "../services/session-store";

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStore: NativeSecureStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, options),
};
