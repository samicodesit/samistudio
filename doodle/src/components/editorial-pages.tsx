import Link from "next/link";
import type { Metadata } from "next";
import {
  ARTICLE_SLUGS,
  EDITORIAL_REVIEW,
  getEditorialAlternates,
  getEditorialCopy,
  getEditorialPath,
  getLocalizedArticle,
  type ArticleSlug,
  type EditorialSegment,
} from "@/lib/editorial";
import { getCopy, htmlLang, localePath, openGraphLocale, SITE_URL, textDirection, type Locale } from "@/lib/i18n";

export function buildEditorialMetadata(locale: Locale, segment: EditorialSegment, slug?: ArticleSlug): Metadata {
  const copy = getEditorialCopy(locale);
  const article = slug ? getLocalizedArticle(locale, slug) : undefined;
  const title = article?.title ?? (segment === "blog" ? copy.blog.title : copy.forAi.title);
  const description = article?.description ?? (segment === "blog" ? copy.blog.description : copy.forAi.description);
  const canonical = `${SITE_URL}${getEditorialPath(locale, segment, slug)}`;
  return {
    title,
    description,
    alternates: { canonical, languages: getEditorialAlternates(segment, slug) },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    openGraph: {
      type: article ? "article" : "website",
      url: canonical,
      siteName: "Doodle",
      title,
      description,
      locale: openGraphLocale(locale),
    },
    twitter: { card: "summary", title, description },
  };
}

function JsonLd({ value }: { value: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }} />;
}

function EditorialHeader({ locale }: { locale: Locale }) {
  const copy = getEditorialCopy(locale);
  return (
    <header className="doodle-header editorial-header">
      <Link className="doodle-wordmark" href={localePath(locale)} aria-label="Doodle" dir="ltr">Doodle<span aria-hidden="true">.</span></Link>
      <nav className="editorial-nav" aria-label={copy.nav.blog}>
        <Link href={getEditorialPath(locale, "blog")}>{copy.nav.blog}</Link>
        <Link href={getEditorialPath(locale, "for-ai")}>{copy.nav.forAi}</Link>
        <Link href={`${localePath(locale)}#composer`}>{copy.nav.app}</Link>
      </nav>
    </header>
  );
}

function EditorialFooter({ locale }: { locale: Locale }) {
  const copy = getEditorialCopy(locale);
  const siteCopy = getCopy(locale);
  return (
    <footer className="site-footer editorial-footer">
      <nav aria-label={copy.nav.blog}>
        <Link href={localePath(locale)}>{copy.nav.app}</Link>
        <Link href={getEditorialPath(locale, "blog")}>{copy.nav.blog}</Link>
        <Link href={getEditorialPath(locale, "for-ai")}>{copy.nav.forAi}</Link>
        <Link href="/privacy">{siteCopy.footer.privacy}</Link>
      </nav>
      <span>© {new Date().getUTCFullYear()} Doodle</span>
    </footer>
  );
}

export function EditorialBlogPage({ locale }: { locale: Locale }) {
  const copy = getEditorialCopy(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.blog.title,
    description: copy.blog.description,
    url: `${SITE_URL}${getEditorialPath(locale, "blog")}`,
    inLanguage: htmlLang(locale),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: ARTICLE_SLUGS.map((slug, index) => {
        const item = getLocalizedArticle(locale, slug);
        return { "@type": "ListItem", position: index + 1, url: `${SITE_URL}${getEditorialPath(locale, "blog", slug)}`, name: item.title };
      }),
    },
  };
  return (
    <>
      <EditorialHeader locale={locale} />
      <main className="editorial-page" dir={textDirection(locale)}>
        <section className="editorial-hero">
          <p className="eyebrow">{copy.blog.eyebrow}</p>
          <h1>{copy.blog.title}</h1>
          <p>{copy.blog.description}</p>
        </section>
        <section className="editorial-grid" aria-label={copy.blog.title}>
          {ARTICLE_SLUGS.map((slug) => {
            const item = getLocalizedArticle(locale, slug);
            return (
              <article className="editorial-card" key={slug}>
                <p className="eyebrow">{item.eyebrow}</p>
                <h2><Link href={getEditorialPath(locale, "blog", slug)}>{item.title}</Link></h2>
                <p>{item.description}</p>
                <Link className="editorial-link" href={getEditorialPath(locale, "blog", slug)}>{copy.blog.readMore}</Link>
              </article>
            );
          })}
        </section>
        <section className="editorial-cta">
          <h2>{copy.nav.app}</h2>
          <Link className="editorial-button" href={`${localePath(locale)}#composer`}>{copy.nav.tryDoodle}</Link>
        </section>
      </main>
      <EditorialFooter locale={locale} />
      <JsonLd value={structuredData} />
    </>
  );
}

export function EditorialArticlePage({ locale, slug }: { locale: Locale; slug: ArticleSlug }) {
  const copy = getEditorialCopy(locale);
  const item = getLocalizedArticle(locale, slug);
  const related = ARTICLE_SLUGS.filter((candidate) => candidate !== slug);
  const articleUrl = `${SITE_URL}${getEditorialPath(locale, "blog", slug)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: item.title,
    description: item.description,
    datePublished: EDITORIAL_REVIEW.sourceDate,
    dateModified: EDITORIAL_REVIEW.sourceDate,
    inLanguage: htmlLang(locale),
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    author: { "@type": "Organization", name: "Doodle", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Doodle", url: SITE_URL },
  };
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: copy.blog.title, item: `${SITE_URL}${getEditorialPath(locale, "blog")}` },
      { "@type": "ListItem", position: 2, name: item.title, item: articleUrl },
    ],
  };
  return (
    <>
      <EditorialHeader locale={locale} />
      <main className="editorial-page editorial-article-page" dir={textDirection(locale)}>
        <article className="editorial-article">
          <Link className="editorial-back" href={getEditorialPath(locale, "blog")}>← {copy.blog.back}</Link>
          <p className="eyebrow">{item.eyebrow}</p>
          <h1>{item.title}</h1>
          <p className="editorial-lede">{item.intro}</p>
          <p className="editorial-date">{copy.articleLabels.published}: {EDITORIAL_REVIEW.sourceDate}</p>
          <section aria-labelledby="editorial-steps-title">
            <h2 id="editorial-steps-title">{copy.articleLabels.steps}</h2>
            <ol className="editorial-steps">
              {item.steps.map((step) => <li key={step.heading}><h3>{step.heading}</h3><p>{step.body}</p></li>)}
            </ol>
          </section>
          <aside className="editorial-tip"><h2>{item.tipTitle}</h2><p>{item.tipBody}</p></aside>
          <Link className="editorial-button" href={`${localePath(locale)}?scene=${encodeURIComponent(item.title)}#composer`}>{copy.nav.tryDoodle}</Link>
        </article>
        <section className="editorial-related" aria-labelledby="editorial-related-title">
          <h2 id="editorial-related-title">{copy.nav.related}</h2>
          <ul>{related.map((candidate) => <li key={candidate}><Link href={getEditorialPath(locale, "blog", candidate)}>{getLocalizedArticle(locale, candidate).title}</Link></li>)}</ul>
        </section>
      </main>
      <EditorialFooter locale={locale} />
      <JsonLd value={structuredData} />
      <JsonLd value={breadcrumbData} />
    </>
  );
}

export function ForAiPage({ locale }: { locale: Locale }) {
  const copy = getEditorialCopy(locale);
  const siteCopy = getCopy(locale);
  const pageUrl = `${SITE_URL}${getEditorialPath(locale, "for-ai")}`;
  const structuredData = { "@context": "https://schema.org", "@type": "WebPage", name: copy.forAi.title, description: copy.forAi.description, url: pageUrl, inLanguage: htmlLang(locale) };
  return (
    <>
      <EditorialHeader locale={locale} />
      <main className="editorial-page editorial-ai-page" dir={textDirection(locale)}>
        <section className="editorial-hero">
          <p className="eyebrow">{copy.forAi.eyebrow}</p>
          <h1>{copy.forAi.title}</h1>
          <p>{copy.forAi.description}</p>
        </section>
        <section className="editorial-prose">
          <h2>{copy.forAi.useTitle}</h2>
          <p>{copy.forAi.intro}</p>
          <ul>{copy.forAi.uses.map((use) => <li key={use}>{use}</li>)}</ul>
          <p>{copy.forAi.trial}</p>
          <p>{copy.forAi.privacy} (<Link href="/privacy">{siteCopy.footer.privacy}</Link>)</p>
          <div className="editorial-actions">
            <Link className="editorial-button" href={`${localePath(locale)}#composer`}>{copy.forAi.start}</Link>
            <Link className="editorial-link" href={getEditorialPath(locale, "blog")}>{copy.forAi.blog}</Link>
          </div>
        </section>
      </main>
      <EditorialFooter locale={locale} />
      <JsonLd value={structuredData} />
    </>
  );
}
