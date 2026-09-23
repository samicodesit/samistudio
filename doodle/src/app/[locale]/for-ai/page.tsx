import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForAiPage, buildEditorialMetadata } from "@/components/editorial-pages";
import { SUPPORTED_LOCALES, hasLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(locale) && locale !== "en" ? buildEditorialMetadata(locale, "for-ai") : {};
}

export default async function LocalizedForAiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale) || locale === "en") notFound();
  return <ForAiPage locale={locale} />;
}
