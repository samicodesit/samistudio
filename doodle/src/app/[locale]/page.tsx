import { notFound } from "next/navigation";
import { DoodlePage } from "@/components/doodle-page";
import { MAX_SCENE_LENGTH } from "@/lib/app-config";
import { hasLocale } from "@/lib/i18n";

export default async function LocalizedPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ scene?: string | string[] }> }) {
  const { locale } = await params;
  if (!hasLocale(locale) || locale === "en") notFound();
  const scene = (await searchParams).scene;
  return <DoodlePage locale={locale} initialScene={typeof scene === "string" ? scene.trim().slice(0, MAX_SCENE_LENGTH) : ""} />;
}
