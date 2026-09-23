import { NATIVE_REPORT_DETAILS_MAX_LENGTH } from "./types";

export const NATIVE_CHARACTER_COUNT_THRESHOLD = 150;

export function loadingMessageAt(messages: readonly string[], index: number): string {
  if (messages.length === 0) return "";
  const safeIndex = Math.min(Math.max(Number.isFinite(index) ? Math.trunc(index) : 0, 0), messages.length - 1);
  return messages[safeIndex] ?? messages[0] ?? "";
}

export function characterCountLabel(scene: string, maxLength: number): { used: number; remaining: number } {
  const used = Array.from(scene).length;
  return { used, remaining: Math.max(0, maxLength - used) };
}

export function canSubmitScene(scene: string, maxLength: number): boolean {
  const count = characterCountLabel(scene, maxLength).used;
  return scene.trim().length > 0 && count <= maxLength;
}

export function shouldShowCharacterCount(usedLength: number): boolean {
  return Number.isFinite(usedLength) && usedLength >= NATIVE_CHARACTER_COUNT_THRESHOLD;
}

export function canSubmitReport(reason: string, details: string, pending: boolean): boolean {
  const detailsRequired = reason === "other";
  const detailCount = Array.from(details).length;
  return !pending && reason.length > 0 && detailCount <= NATIVE_REPORT_DETAILS_MAX_LENGTH && (!detailsRequired || details.trim().length > 0);
}
