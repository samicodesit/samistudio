import Link from "next/link";
import Image from "next/image";
import { ARTICLE_SLUGS, getEditorialCopy, getEditorialPath, getLocalizedArticle } from "@/lib/editorial";
import type { Locale } from "@/lib/i18n";
import "./discovery-links.css";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=nl.samistudio.doodle";

const APP_LINK_LABELS: Record<Locale, string> = {
  en: "Get Doodle on Google Play",
  nl: "Download Doodle op Google Play",
  de: "Doodle bei Google Play herunterladen",
  fr: "Télécharger Doodle sur Google Play",
  es: "Descarga Doodle en Google Play",
  "pt-br": "Baixe o Doodle no Google Play",
  it: "Scarica Doodle su Google Play",
  ja: "Google Play で Doodle をダウンロード",
  ko: "Google Play에서 Doodle 다운로드",
  ar: "نزّل Doodle من Google Play",
};

export function AndroidAppLink({ locale }: { locale: Locale }) {
  return <div className="android-app-link">
    <a href={PLAY_STORE_URL} aria-label={APP_LINK_LABELS[locale]}>
      <Image src={`/store-badges/google-play-${locale}.svg`} alt="" width={239} height={71} unoptimized />
    </a>
  </div>;
}

export function DrawingGuides({ locale }: { locale: Locale }) {
  const copy = getEditorialCopy(locale);
  return <section className="drawing-guides" aria-labelledby="drawing-guides-title">
    <h2 id="drawing-guides-title">{copy.blog.title}</h2>
    <div className="drawing-guides-grid">
      {ARTICLE_SLUGS.map(slug => {
        const guide = getLocalizedArticle(locale, slug);
        return <article key={slug}>
          <h3><Link href={getEditorialPath(locale, "blog", slug)}>{guide.title}</Link></h3>
          <p>{guide.description}</p>
        </article>;
      })}
    </div>
  </section>;
}
