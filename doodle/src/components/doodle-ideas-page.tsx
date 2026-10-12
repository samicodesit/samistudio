import Link from "next/link";
import { IdeaGallery } from "./idea-gallery";
import { AndroidAppLink } from "./discovery-links";
import { getDoodleIdeas, ideasPath } from "@/lib/doodle-ideas";
import { SITE_URL, SUPPORTED_LOCALES, type Locale, getCopy, htmlLang, localePath } from "@/lib/i18n";
import { ARTICLE_SLUGS, getEditorialCopy, getEditorialPath } from "@/lib/editorial";

import { getGalleryItems } from "@/lib/gallery-catalog";
import { getGalleryCopy } from "@/lib/gallery-copy";
import { getLandingResources } from "@/lib/landing-resources";

export function DoodleIdeasPage({ locale }: { locale: Locale }) {
  const copy = getDoodleIdeas(locale);
  const items = getGalleryItems(locale);
  const gallery = getGalleryCopy(locale);
  const resources = getLandingResources(locale);
  const siteCopy = getCopy(locale);
  const editorialCopy = getEditorialCopy(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.seoTitle,
    description: copy.seoDescription,
    url: `${SITE_URL}${ideasPath(locale)}`,
    inLanguage: htmlLang(locale),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@type": "ImageObject", name: item.caption, contentUrl: `${SITE_URL}${item.image}`, description: item.prompt },
      })),
    },
  };

  return (
    <>
      <header className="doodle-header ideas-header">
        <Link className="doodle-wordmark" href={localePath(locale)} aria-label={siteCopy.header.homeLabel} dir="ltr">Doodle<span aria-hidden="true">.</span></Link>
        <details className="language-switcher">
          <summary aria-label={siteCopy.header.languageLabel}>{siteCopy.localeLabel}</summary>
          <nav aria-label={siteCopy.header.languageLabel}>
            {SUPPORTED_LOCALES.filter((item) => item !== locale).map((item) => <Link key={item} href={ideasPath(item)} hrefLang={htmlLang(item)}>{getCopy(item).localeLabel}</Link>)}
          </nav>
        </details>
      </header>
      <main className="ideas-page">
        <section className="ideas-hero">
          <h1>{gallery.title}</h1>
          <p>{gallery.description}</p>
        </section>
        <IdeaGallery locale={locale} items={items} labels={{ all: gallery.all, viewLarger: copy.viewLarger, tryIdea: copy.tryIdea, openTab: copy.openTab }} />
      </main>
      <footer className="site-footer ideas-footer">
        <AndroidAppLink locale={locale} />
        <nav className="ideas-footer-guides" aria-label={editorialCopy.nav.blog}>
          {ARTICLE_SLUGS.map((slug, index) => <Link key={slug} href={getEditorialPath(locale, "blog", slug)}>{resources.guides[index]}</Link>)}
        </nav>
        <nav aria-label={siteCopy.footer.contact}>
          <Link href={localePath(locale)}>{copy.generator}</Link><Link href={getEditorialPath(locale, "blog")}>{editorialCopy.nav.blog}</Link><Link href={getEditorialPath(locale, "for-ai")}>{editorialCopy.nav.forAi}</Link><Link href="/privacy">{siteCopy.footer.privacy}</Link><Link href="/terms">{siteCopy.footer.terms}</Link><Link href="/contact">{siteCopy.footer.contact}</Link>
        </nav>
        <span>© {new Date().getUTCFullYear()} Doodle</span>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
