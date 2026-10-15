import type { DetailLevel } from "./generation/detail-level";
type CheckoutData = { image: Blob; scene: string; detailLevel: DetailLevel; photo?: string; lastFree: boolean };

const TTL = 30 * 60_000;
const STORE = "drafts";
type StoredDraft = { id: string; image: Blob; scene: string; detailLevel: DetailLevel; photo?: string; lastFree: boolean; expiresAt: number };

export function discardCheckoutDraft() {
  try {
    const id = sessionStorage.getItem("doodle:checkout-draft-id");
    sessionStorage.removeItem("doodle:checkout-draft-id");
    if (id) void checkoutDraftStore("remove", id).catch(() => {});
  } catch { /* Local storage can be unavailable. */ }
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doodle-checkout-draft", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function checkoutDraftStore(action: "read" | "write" | "remove", id: string, data?: CheckoutData): Promise<StoredDraft | undefined> {
  // Store bytes, because some WebKit versions reject Blob values in IndexedDB.
  const imageBytes = action === "write" && data ? await data.image.arrayBuffer() : undefined;
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let result: StoredDraft | undefined;
      // Remove expired drafts whenever the store is accessed, including other tabs.
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) { if (item.value.expiresAt <= Date.now()) item.delete(); item.continue(); }
      };
      if (action === "write" && data) {
        const { image, ...draft } = data;
        store.put({ id, ...draft, imageBytes, imageType: image.type, expiresAt: Date.now() + TTL });
      }
      if (action === "remove") store.delete(id);
      if (action === "read") {
        const request = store.get(id);
        request.onsuccess = () => {
          const value = request.result as (StoredDraft & { imageBytes?: ArrayBuffer; imageType?: string }) | undefined;
          const image = value?.imageBytes instanceof ArrayBuffer && typeof value.imageType === "string"
            ? new Blob([value.imageBytes], { type: value.imageType }) : value?.image;
          if (value && value.expiresAt > Date.now() && image instanceof Blob && image.size > 0 && image.size <= 20*1024*1024 && typeof value.scene === "string" && ["simple","medium","detailed"].includes(value.detailLevel)) result = { ...value, image };
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function saveCheckoutDraft(data: CheckoutData) {
  if(typeof indexedDB==="undefined")throw new Error("Drawing storage unavailable");
  const id=sessionStorage.getItem("doodle:checkout-draft-id") ?? crypto.randomUUID();
  await checkoutDraftStore("write",id,data);
  sessionStorage.setItem("doodle:checkout-draft-id",id);
}
export async function readCheckoutDraft() {
  const id=sessionStorage.getItem("doodle:checkout-draft-id");
  return id ? checkoutDraftStore("read",id) : undefined;
}
