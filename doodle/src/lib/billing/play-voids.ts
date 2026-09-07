import "server-only";

import { GoogleAuth } from "google-auth-library";
import type { PlayBillingConfig } from "./play-config";
import {
  previewPlayPurchaseVoid,
  voidPlayPurchase,
  type PlayVoidMetadata,
  type PlayVoidResult,
} from "./play-credits";

const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const THIRTY_DAYS_MS = 30 * 86_400_000;
const MAX_PAGES = 100;
const MAX_RECORDS = 10_000;

export type VoidedPurchase = {
  purchaseToken?: string;
  voidedTimeMillis?: string;
  voidedReason?: number;
  voidedSource?: number;
  voidedQuantity?: number;
};

export type PlayVoidsPage = {
  voidedPurchases: VoidedPurchase[];
  nextPageToken?: string;
};

export interface PlayVoidsClient {
  listVoidedPurchases(input: { startTimeMs: number; endTimeMs: number; pageToken?: string }): Promise<PlayVoidsPage>;
}

export type PlayVoidsSummary = {
  mode: "dry-run" | "apply";
  fetched: number;
  alreadyVoided: number;
  tombstoned: number;
  reversed: number;
  deletedAccounts: number;
  inactiveAccounts: number;
  recovered: number;
  unrecovered: number;
};

export function validatePlayVoidRange(startTimeMs: number, endTimeMs: number, nowMs = Date.now()) {
  if (![startTimeMs, endTimeMs, nowMs].every(Number.isSafeInteger) || startTimeMs < 0 || endTimeMs < startTimeMs) {
    throw new Error("Play void range must be ordered");
  }
  if (endTimeMs > nowMs) throw new Error("Play void range cannot end in the future");
  if (startTimeMs < nowMs - THIRTY_DAYS_MS) throw new Error("Play void range must be within 30 days");
  return { startTimeMs, endTimeMs };
}

function pageToken(value: string) {
  if (!value || value.length > 2_048 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new Error("Invalid Play pagination token");
  return value;
}

export function createPlayVoidsClient(config: PlayBillingConfig): PlayVoidsClient {
  const auth = new GoogleAuth({ credentials: config.credentials, scopes: [ANDROID_PUBLISHER_SCOPE] });
  return {
    async listVoidedPurchases(input) {
      const query = new URLSearchParams({
        type: "0",
        includeQuantityBasedPartialRefund: "true",
        maxResults: "100",
      });
      if (input.pageToken) {
        query.set("token", pageToken(input.pageToken));
      } else {
        query.set("startTime", String(input.startTimeMs));
        query.set("endTime", String(input.endTimeMs));
      }
      const client = await auth.getClient();
      const response = await client.request<{
        voidedPurchases?: VoidedPurchase[];
        tokenPagination?: { nextPageToken?: string };
      }>({
        method: "GET",
        timeout: 15_000,
        url: `${API_BASE}/applications/${encodeURIComponent(config.packageName)}/purchases/voidedpurchases?${query}`,
      });
      return {
        voidedPurchases: response.data.voidedPurchases ?? [],
        nextPageToken: response.data.tokenPagination?.nextPageToken,
      };
    },
  };
}

function parseVoidedPurchase(value: VoidedPurchase, nowMs: number): { purchaseToken: string; metadata: PlayVoidMetadata } {
  const token = value.purchaseToken;
  const voidedAtMs = Number(value.voidedTimeMillis);
  const quantity = value.voidedQuantity ?? 1;
  if (
    typeof token !== "string" || token.length < 16 || token.length > 4_096 || /[\s\u0000-\u001f\u007f]/u.test(token) ||
    !Number.isSafeInteger(voidedAtMs) || voidedAtMs < 0 || voidedAtMs > nowMs ||
    !Number.isInteger(value.voidedReason) || value.voidedReason! < 0 || value.voidedReason! > 8 ||
    !Number.isInteger(value.voidedSource) || value.voidedSource! < 0 || value.voidedSource! > 2 ||
    quantity !== 1
  ) throw new Error("Invalid voided purchase");
  return {
    purchaseToken: token,
    metadata: {
      voidedAt: new Date(voidedAtMs).toISOString(),
      voidedReason: value.voidedReason!,
      voidedSource: value.voidedSource!,
      voidedQuantity: 1,
    },
  };
}

function addResult(summary: PlayVoidsSummary, result: PlayVoidResult) {
  if (result.status === "already_voided") {
    summary.alreadyVoided += 1;
    return;
  }
  else if (result.status === "tombstoned") summary.tombstoned += 1;
  else if (result.status === "reversed") summary.reversed += 1;
  else if (result.status === "deleted_account") summary.deletedAccounts += 1;
  else summary.inactiveAccounts += 1;
  summary.recovered += result.recovered;
  summary.unrecovered += result.unrecovered;
}

export async function reconcilePlayVoids(input: {
  client: PlayVoidsClient;
  startTimeMs: number;
  endTimeMs: number;
  nowMs?: number;
  apply?: boolean;
}): Promise<PlayVoidsSummary> {
  const nowMs = input.nowMs ?? Date.now();
  validatePlayVoidRange(input.startTimeMs, input.endTimeMs, nowMs);
  const summary: PlayVoidsSummary = {
    mode: input.apply ? "apply" : "dry-run",
    fetched: 0,
    alreadyVoided: 0,
    tombstoned: 0,
    reversed: 0,
    deletedAccounts: 0,
    inactiveAccounts: 0,
    recovered: 0,
    unrecovered: 0,
  };
  const seenPageTokens = new Set<string>();
  const seenPurchaseTokens = new Set<string>();
  let nextPageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await input.client.listVoidedPurchases({
      startTimeMs: input.startTimeMs,
      endTimeMs: input.endTimeMs,
      pageToken: nextPageToken,
    });
    if (!Array.isArray(response.voidedPurchases)) throw new Error("Invalid Play void response");
    summary.fetched += response.voidedPurchases.length;
    if (summary.fetched > MAX_RECORDS) throw new Error("Play void response exceeds limit");
    const records = response.voidedPurchases.map((record) => parseVoidedPurchase(record, nowMs));
    for (const record of records) {
      if (seenPurchaseTokens.has(record.purchaseToken)) continue;
      seenPurchaseTokens.add(record.purchaseToken);
      const result = input.apply
        ? await voidPlayPurchase(record.purchaseToken, record.metadata)
        : await previewPlayPurchaseVoid(record.purchaseToken, record.metadata);
      addResult(summary, result);
    }

    if (!response.nextPageToken) return summary;
    nextPageToken = pageToken(response.nextPageToken);
    if (seenPageTokens.has(nextPageToken)) throw new Error("Play void pagination loop");
    seenPageTokens.add(nextPageToken);
  }
  throw new Error("Play void response exceeds page limit");
}
