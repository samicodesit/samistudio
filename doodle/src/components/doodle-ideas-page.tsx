import Link from "next/link";
import { IdeaGallery } from "./idea-gallery";
import { IDEA_IMAGES, getDoodleIdeas, ideasPath } from "@/lib/doodle-ideas";
import { SITE_URL, SUPPORTED_LOCALES, type Locale, getCopy, htmlLang, localePath } from "@/lib/i18n";

export function DoodleIdeasPage({ locale }: { locale: Locale }) {
  const copy = getDoodleIdeas(locale);
  const siteCopy = getCopy(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.seoTitle,
    description: copy.seoDescription,
    url: `${SITE_URL}${ideasPath(locale)}`,
    inLanguage: htmlLang(locale),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: copy.featured.map((prompt, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@type": "ImageObject", name: prompt, contentUrl: `${SITE_URL}${IDEA_IMAGES[index]}`, description: prompt },
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
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <Link className="ideas-hero-link" href={`${localePath(locale)}#composer`}>{copy.start}</Link>
        </section>
        <IdeaGallery locale={locale} copy={copy} />
        <section className="quick-ideas" aria-labelledby="quick-ideas-title">
          <div>
            <p className="eyebrow">{copy.moreEyebrow}</p>
            <h2 id="quick-ideas-title">{copy.moreTitle}</h2>
            <p>{copy.moreBody}</p>
          </div>
          <ul>
            {copy.quickIdeas.map((idea) => <li key={idea}><span>{idea}</span><Link href={`${localePath(locale)}?scene=${encodeURIComponent(idea)}#composer`} aria-label={`${copy.tryIdea}: ${idea}`}>{copy.tryIdea}</Link></li>)}
          </ul>
        </section>
        <section className="ideas-guide">
          <h2>{copy.guideTitle}</h2>
          <p>{copy.guideBody}</p>
          <Link href={`${localePath(locale)}#composer`}>{copy.guideCta}</Link>
        </section>
      </main>
      <footer className="site-footer ideas-footer">
        <nav aria-label={siteCopy.footer.contact}>
          <Link href={localePath(locale)}>{copy.generator}</Link><Link href="/privacy">{siteCopy.footer.privacy}</Link><Link href="/terms">{siteCopy.footer.terms}</Link><Link href="/contact">{siteCopy.footer.contact}</Link>
        </nav>
        <span>© {new Date().getUTCFullYear()} Doodle</span>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
