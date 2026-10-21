import { isPhotoPayload } from "./generation/photo-input";

const TTL = 30 * 60_000;
const STORE = "drafts";
type StoredDraft = { id: string; base64: string; scene: string; expiresAt: number };

export function discardPhotoDraft() {
  try {
    const id = sessionStorage.getItem("doodle:photo-draft-id");
    sessionStorage.removeItem("doodle:photo-draft-id");
    if (id) void photoDraftStore("remove", id).catch(() => {});
  } catch { /* Local storage can be unavailable. */ }
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doodle-photo-draft", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function photoDraftStore(action: "read" | "write" | "remove", id: string, data?: { base64: string; scene: string }): Promise<StoredDraft | undefined> {
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
      if (action === "write" && data) store.put({ id, ...data, expiresAt: Date.now() + TTL });
      if (action === "remove") store.delete(id);
      if (action === "read") {
        const request = store.get(id);
        request.onsuccess = () => {
          const value = request.result as StoredDraft | undefined;
          if (value && value.expiresAt > Date.now() && isPhotoPayload(value.base64) && typeof value.scene === "string") result = value;
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
