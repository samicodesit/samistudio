import { notFound } from "next/navigation";
import { DoodlePage } from "@/components/doodle-page";
import { hasLocale } from "@/lib/i18n";

export default async function LocalizedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale) || locale === "en") notFound();
  return <DoodlePage locale={locale} />;
}
