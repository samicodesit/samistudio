import {
  SUPPORTED_LOCALES,
  formatCount,
  getCopy,
  textDirection,
  type Locale,
  type PluralTemplates,
} from "../../../src/lib/i18n";
import { getDoodleIdeas } from "../../../src/lib/doodle-ideas";
import { REPORT_COPY } from "../../../src/lib/reports/report-copy";
import type {
  NativeDirection,
  NativeDoodleUiCopy,
  NativeIdea,
  NativeLocale,
  NativeLocaleOption,
  NativeSupportLink,
} from "../ui/types";

const NATIVE_NAVIGATION: Record<NativeLocale, { create: string; ideas: string; settings: string; appLabel: string; settingsTitle: string; supportTitle: string }> = {
  en: { create: "Create", ideas: "Ideas", settings: "Settings", appLabel: "Doodle navigation", settingsTitle: "Settings", supportTitle: "Support" },
  nl: { create: "Maken", ideas: "Ideeën", settings: "Instellingen", appLabel: "Doodle-navigatie", settingsTitle: "Instellingen", supportTitle: "Hulp" },
  de: { create: "Erstellen", ideas: "Ideen", settings: "Einstellungen", appLabel: "Doodle-Navigation", settingsTitle: "Einstellungen", supportTitle: "Hilfe" },
  fr: { create: "Créer", ideas: "Idées", settings: "Réglages", appLabel: "Navigation Doodle", settingsTitle: "Réglages", supportTitle: "Aide" },
  es: { create: "Crear", ideas: "Ideas", settings: "Ajustes", appLabel: "Navegación de Doodle", settingsTitle: "Ajustes", supportTitle: "Ayuda" },
  "pt-br": { create: "Criar", ideas: "Ideias", settings: "Configurações", appLabel: "Navegação do Doodle", settingsTitle: "Configurações", supportTitle: "Ajuda" },
  it: { create: "Crea", ideas: "Idee", settings: "Impostazioni", appLabel: "Navigazione Doodle", settingsTitle: "Impostazioni", supportTitle: "Supporto" },
  ja: { create: "作成", ideas: "アイデア", settings: "設定", appLabel: "Doodle ナビゲーション", settingsTitle: "設定", supportTitle: "サポート" },
  ko: { create: "만들기", ideas: "아이디어", settings: "설정", appLabel: "Doodle 탐색", settingsTitle: "설정", supportTitle: "지원" },
  ar: { create: "إنشاء", ideas: "أفكار", settings: "الإعدادات", appLabel: "تنقّل Doodle", settingsTitle: "الإعدادات", supportTitle: "الدعم" },
};

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/[—–]/g, "-");
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

export function nativeDirection(locale: NativeLocale): NativeDirection {
  return textDirection(locale as Locale);
}

export function getNativeCopy(locale: NativeLocale): NativeDoodleUiCopy {
  const source = sanitize(getCopy(locale as Locale)) as ReturnType<typeof getCopy>;
  const report = sanitize(REPORT_COPY[locale as Locale]);
  const navigation = NATIVE_NAVIGATION[locale];
  const ideas = getDoodleIdeas(locale as Locale);
  return {
    localeLabel: source.localeLabel,
    header: { languageLabel: source.header.languageLabel },
    footer: source.footer,
    composer: source.composer,
    errors: source.errors,
    suggestions: source.suggestions,
    stage: source.stage,
    actions: source.actions,
    dialog: source.dialog,
    usage: source.usage,
    purchase: source.purchase,
    auth: source.auth,
    account: source.account,
    navigation: {
      create: navigation.create,
      ideas: navigation.ideas,
      settings: navigation.settings,
      appLabel: navigation.appLabel,
    },
    ideas: {
      title: sanitize(ideas.title) as string,
      hint: sanitize(ideas.description) as string,
      tryIdea: sanitize(ideas.tryIdea) as string,
    },
    settings: {
      title: navigation.settingsTitle,
      supportTitle: navigation.supportTitle,
    },
    result: {
      share: locale === "en" ? "Share doodle" : localizedShareLabel(locale),
      more: locale === "en" ? "More options" : localizedMoreLabel(locale),
      report: reportValue(report, "trigger"),
    },
    report: {
      title: reportValue(report, "title"),
      intro: reportValue(report, "intro"),
      reasonLabel: reportValue(report, "reasonLabel"),
      chooseReason: reportValue(report, "chooseReason"),
      detailsOptional: reportValue(report, "detailsOptional"),
      detailsRequired: reportValue(report, "detailsRequired"),
      detailsPlaceholder: reportValue(report, "detailsPlaceholder"),
      includeContent: reportValue(report, "includeContent"),
      submit: reportValue(report, "submit"),
      cancel: reportValue(report, "cancel"),
      close: reportValue(report, "close"),
      success: reportValue(report, "success"),
      reference: reportValue(report, "reference"),
      error: reportValue(report, "error"),
      reasons: reportValue(report, "reasons"),
    },
  };
}

function reportValue(report: unknown, key: string): any {
  if (!report || typeof report !== "object") return "";
  return (report as Record<string, unknown>)[key];
}

function localizedShareLabel(locale: NativeLocale): string {
  const values: Record<NativeLocale, string> = { en: "Share doodle", nl: "Doodle delen", de: "Doodle teilen", fr: "Partager le dessin", es: "Compartir dibujo", "pt-br": "Compartilhar desenho", it: "Condividi doodle", ja: "イラストを共有", ko: "그림 공유", ar: "مشاركة الرسمة" };
  return values[locale];
}

function localizedMoreLabel(locale: NativeLocale): string {
  const values: Record<NativeLocale, string> = { en: "More options", nl: "Meer opties", de: "Weitere Optionen", fr: "Plus d’options", es: "Más opciones", "pt-br": "Mais opções", it: "Altre opzioni", ja: "その他のオプション", ko: "더 보기", ar: "خيارات أخرى" };
  return values[locale].replace(/[—–]/g, "-");
}

export function getNativeIdeas(locale: NativeLocale, assets: readonly [string, NativeIdea["imageUri"]][] = []): readonly NativeIdea[] {
  const source = getDoodleIdeas(locale as Locale);
  return assets.map(([id, imageUri], index) => ({
    id,
    imageUri,
    prompt: sanitize(source.featured[index] ?? "") as string,
    actionLabel: sanitize(source.tryIdea) as string,
  }));
}

export function getNativeLocales(): readonly NativeLocaleOption[] {
  return SUPPORTED_LOCALES.map((value) => ({ value: value as NativeLocale, label: sanitize(getCopy(value).localeLabel) as string }));
}

export function getNativeSupportLinks(locale: NativeLocale): readonly NativeSupportLink[] {
  const footer = getCopy(locale as Locale).footer;
  return [
    { id: "contact", label: sanitize(footer.contact) as string },
    { id: "privacy", label: sanitize(footer.privacy) as string },
    { id: "terms", label: sanitize(footer.terms) as string },
    { id: "refunds", label: sanitize(footer.refunds) as string },
  ];
}

export function getNativeLoadingMessages(locale: NativeLocale): readonly string[] {
  return (sanitize(getCopy(locale as Locale).stage.loadingMessages) as readonly string[]).slice();
}

export function getNativeUsageLabel(locale: NativeLocale, freeRemaining: number | null, paidRemaining: number | null): string {
  const copy = getCopy(locale as Locale);
  if (typeof paidRemaining === "number" && paidRemaining > 0) return formatCount(locale as Locale, copy.usage.paidLeft as PluralTemplates, paidRemaining);
  if (typeof freeRemaining === "number") return formatCount(locale as Locale, copy.usage.freeLeft as PluralTemplates, freeRemaining);
  if (typeof paidRemaining === "number") return formatCount(locale as Locale, copy.usage.paidLeft as PluralTemplates, paidRemaining);
  return sanitize(copy.usage.firstTwoFree) as string;
}

export function localeFromDevice(locales: readonly { languageTag?: string | null; languageCode?: string | null }[]): NativeLocale {
  for (const locale of locales) {
    const tag = (locale.languageTag ?? locale.languageCode ?? "").toLowerCase().replace("_", "-");
    if (tag === "pt-br" || tag.startsWith("pt-br-")) return "pt-br";
    const language = tag.split("-")[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(language)) return language as NativeLocale;
  }
  return "en";
}

export function isNativeLocale(value: string | null | undefined): value is NativeLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
