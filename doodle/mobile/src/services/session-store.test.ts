import { describe, expect, it } from "vitest";
import { NativeSessionStore } from "./session-store";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => void values.set(key, value),
    deleteItem: async (key: string) => void values.delete(key),
  };
}

describe("NativeSessionStore", () => {
  it("knows a fresh installation is new, without treating a legacy installation as a first buyer", async () => {
    const fresh = new NativeSessionStore(storage());
    expect(await fresh.getPurchaseHistoryHint()).toBe(false);
    const legacyData = storage();
    legacyData.values.set("doodle.native.install", "11111111-1111-4111-8111-111111111111");
    expect(await new NativeSessionStore(legacyData).getPurchaseHistoryHint()).toBeUndefined();
  });
  it("retains known purchase history through sign-out and removes it on account deletion", async () => {
    const data = storage();
    const store = new NativeSessionStore(data);
    await store.setPurchaseHistoryHint(true);
    await store.clearAccessToken();
    expect(await new NativeSessionStore(data).getPurchaseHistoryHint()).toBe(true);
    await store.clearPurchaseHistoryHint();
    expect(data.values.has("doodle.native.purchase-history")).toBe(false);
  });
  it("does not invent purchase history from corrupt or unavailable storage", async () => {
    const data = storage();
    data.values.set("doodle.native.purchase-history", "corrupt");
    expect(await new NativeSessionStore(data).getPurchaseHistoryHint()).toBeUndefined();
    data.getItem = async () => { throw new Error("Storage unavailable"); };
    expect(await new NativeSessionStore(data).getPurchaseHistoryHint()).toBeUndefined();
  });
  it("validates the opaque bearer and expiry before returning it", async () => {
    const storeData = storage();
    const store = new NativeSessionStore(storeData, { now: () => 1000 });
    storeData.values.set("doodle.native.access", JSON.stringify({ accessToken: "a".repeat(43), expiresAt: 999 }));

    await expect(store.getAccessToken()).resolves.toBeNull();
    expect(storeData.values.has("doodle.native.access")).toBe(false);
  });

  it("creates one stable lower-case installation id and keeps it in secure storage", async () => {
    const storeData = storage();
    const store = new NativeSessionStore(storeData, { randomUuid: () => "11111111-1111-4111-8111-111111111111" });

    await expect(store.getInstallId()).resolves.toBe("11111111-1111-4111-8111-111111111111");
    await expect(store.getInstallId()).resolves.toBe("11111111-1111-4111-8111-111111111111");
    expect(storeData.values.get("doodle.native.install")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("persists a validated detail preference and defaults corrupt storage to Simple", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); }, deleteItem: async (key: string) => { values.delete(key); } };
    const store = new NativeSessionStore(storage);
    expect(await store.getDetailLevel()).toBe("simple");
    await store.setDetailLevel("detailed");
    expect(await new NativeSessionStore(storage).getDetailLevel()).toBe("detailed");
    values.set("doodle.detail-level", "hard");
    expect(await store.getDetailLevel()).toBe("simple");
  });

  it("falls back to Simple when device storage cannot be read", async () => {
    const data = storage();
    data.getItem = async () => { throw new Error("Storage unavailable"); };
    expect(await new NativeSessionStore(data).getDetailLevel()).toBe("simple");
  });
  it("retains the level when account and trial credentials are cleared", async () => {
    const data = storage();
    const store = new NativeSessionStore(data);
    await store.setDetailLevel("medium");
    await store.clearAccessToken();
    await store.clearTrialToken();
    expect(await store.getDetailLevel()).toBe("medium");
  });

});

