import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoodleIdeasPage } from "@/components/doodle-ideas-page";
import { buildDoodleIdeasMetadata } from "@/lib/doodle-ideas";
import { SUPPORTED_LOCALES, hasLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(locale) && locale !== "en" ? buildDoodleIdeasMetadata(locale) : {};
}

export default async function LocalizedDoodleIdeasRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale) || locale === "en") notFound();
  return <DoodleIdeasPage locale={locale} />;
}
