// Functional wording preference, never a tracking identifier or analytics payload.
const KEY="doodle:has-purchased";
export function rememberPurchase() { try { localStorage.setItem(KEY,"1"); } catch {} }
export function hasPurchaseWording() { try { return localStorage.getItem(KEY)==="1"; } catch { return false; } }
export function clearPurchaseWording() { try { localStorage.removeItem(KEY); } catch {} }
