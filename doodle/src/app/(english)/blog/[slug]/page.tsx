import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialArticlePage, buildEditorialMetadata } from "@/components/editorial-pages";
import { ARTICLE_SLUGS, isArticleSlug } from "@/lib/editorial";

export function generateStaticParams() {
  return ARTICLE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return isArticleSlug(slug) ? buildEditorialMetadata("en", "blog", slug) : {};
}

export default async function EnglishArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isArticleSlug(slug)) notFound();
  return <EditorialArticlePage locale="en" slug={slug} />;
}
