import type { NativeDirection, NativeLocale } from "./types";

export const NATIVE_COLORS = {
  canvas: "#eef1ea",
  paper: "#fcfcf8",
  graphite: "#20231f",
  moss: "#195c47",
  sticky: "#f4d85e",
  loadingYellow: "#f6df75",
  coral: "#b65248",
  muted: "#687068",
  line: "rgba(32, 35, 31, 0.14)",
  softLine: "rgba(32, 35, 31, 0.08)",
  focus: "rgba(25, 92, 71, 0.22)",
  selected: "#e5eee6",
  white: "#ffffff",
  scrim: "rgba(32, 35, 31, 0.52)",
  dangerSurface: "#f8e6e1",
} as const;

export const NATIVE_FONTS = {
  display: "BricolageGrotesque",
  body: "IBMPlexSans",
  arabic: "Alexandria",
} as const;

export const NATIVE_SPACING = {
  screen: 18,
  screenWide: 20,
  section: 24,
  field: 12,
  control: 48,
  tab: 56,
  radius: 14,
  smallRadius: 10,
} as const;

export function nativeFontFamily(locale: NativeLocale, role: "display" | "body"): string {
  if (locale === "ar") return NATIVE_FONTS.arabic;
  return role === "display" ? NATIVE_FONTS.display : NATIVE_FONTS.body;
}

export function nativeRowDirection(direction: NativeDirection): "row" | "row-reverse" {
  return direction === "rtl" ? "row-reverse" : "row";
}

export function nativeTextAlign(direction: NativeDirection): "left" | "right" {
  return direction === "rtl" ? "right" : "left";
}
