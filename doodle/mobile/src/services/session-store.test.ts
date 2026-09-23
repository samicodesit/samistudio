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
});
