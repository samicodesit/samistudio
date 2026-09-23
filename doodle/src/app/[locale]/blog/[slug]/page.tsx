import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialArticlePage, buildEditorialMetadata } from "@/components/editorial-pages";
import { ARTICLE_SLUGS, isArticleSlug } from "@/lib/editorial";
import { SUPPORTED_LOCALES, hasLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.filter((locale) => locale !== "en").flatMap((locale) => ARTICLE_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  return hasLocale(locale) && locale !== "en" && isArticleSlug(slug) ? buildEditorialMetadata(locale, "blog", slug) : {};
}

export default async function LocalizedArticle({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!hasLocale(locale) || locale === "en" || !isArticleSlug(slug)) notFound();
  return <EditorialArticlePage locale={locale} slug={slug} />;
}
