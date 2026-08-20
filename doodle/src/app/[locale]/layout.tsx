import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootDocument } from "../root-document";
import { SUPPORTED_LOCALES, buildPageMetadata, hasLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(locale) && locale !== "en" ? buildPageMetadata(locale) : {};
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale) || locale === "en") notFound();
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
