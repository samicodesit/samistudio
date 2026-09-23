"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

export type SafeAttributionKey = "utm_source" | "utm_medium" | "utm_campaign" | "utm_content";
export type SafeAttribution = Partial<Record<SafeAttributionKey, string>>;

const SAFE_ATTRIBUTION_KEYS: readonly SafeAttributionKey[] = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
const SAFE_ATTRIBUTION_VALUES: Record<SafeAttributionKey, readonly string[]> = {
  utm_source: ["doodle", "instagram", "Pinterest", "pinterest", "reddit", "tiktok"],
  utm_medium: ["community", "organic", "organic_social", "share", "social"],
  utm_campaign: ["birthday_note", "doodle_launch", "doodle_web_launch", "lunchbox_note", "made_with_doodle", "small_moments", "tiny_note_launch"],
  utm_content: ["birthday_card", "demo", "lunchbox_note", "thank_you_mug"],
};
const SAFE_ATTRIBUTION_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function isSafeAttributionValue(key: SafeAttributionKey, value: string): boolean {
  return SAFE_ATTRIBUTION_VALUE.test(value) && SAFE_ATTRIBUTION_VALUES[key].includes(value);
}

export function readSafeAttribution(search: string): SafeAttribution {
  const params = new URLSearchParams(search);
  const attribution: SafeAttribution = {};
  for (const key of SAFE_ATTRIBUTION_KEYS) {
    const values = params.getAll(key);
    if (values.length === 1 && isSafeAttributionValue(key, values[0])) attribution[key] = values[0];
  }
  return attribution;
}

export function serializeSafeAttribution(attribution: SafeAttribution): string {
  const params = new URLSearchParams();
  for (const key of SAFE_ATTRIBUTION_KEYS) {
    const value = attribution[key];
    if (typeof value === "string" && isSafeAttributionValue(key, value)) params.set(key, value);
  }
  return params.toString();
}

export function redactAnalyticsUrl(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    const attribution = readSafeAttribution(url.search);
    url.search = "";
    const safeSearch = serializeSafeAttribution(attribution);
    if (safeSearch) url.search = `?${safeSearch}`;
    url.hash = "";
    return { ...event, url: url.href };
  } catch {
    return null;
  }
}

export function DoodleAnalytics() {
  return <Analytics beforeSend={redactAnalyticsUrl} />;
}
