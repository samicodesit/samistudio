import Link from "next/link";
import { MobileAppWorkspace } from "./mobile-app-workspace";
import {
  SITE_URL,
  SUPPORTED_LOCALES,
  type Locale,
  getCopy,
  htmlLang,
  localePath,
} from "@/lib/i18n";
import { getDoodleIdeas, ideasPath } from "@/lib/doodle-ideas";
import { getEditorialCopy, getEditorialPath } from "@/lib/editorial";
import { DEFAULT_SUGGESTION_IDS, type SceneIdeaId } from "@/lib/scenes/suggestions";

export function DoodlePage({
  locale,
  initialScene = "",
  initialSuggestionIds = DEFAULT_SUGGESTION_IDS,
}: {
  locale: Locale;
  initialScene?: string;
  initialSuggestionIds?: readonly SceneIdeaId[];
}) {
  const copy = getCopy(locale);
  const ideasCopy = getDoodleIdeas(locale);
  const editorialCopy = getEditorialCopy(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Doodle",
    url: `${SITE_URL}${localePath(locale)}`,
    description: copy.seo.description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    inLanguage: htmlLang(locale),
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        description: copy.usage.firstTwoFree,
      },
      {
        "@type": "Offer",
        price: "4.99",
        priceCurrency: "EUR",
        description: copy.purchase.quantity,
      },
    ],
  };

  return (
    <>
      <header className="doodle-header">
        <Link className="doodle-wordmark" href={localePath(locale)} aria-label={copy.header.homeLabel} dir="ltr">
          Doodle<span aria-hidden="true">.</span>
        </Link>
        <details className="language-switcher">
          <summary aria-label={copy.header.languageLabel}>{copy.localeLabel}</summary>
          <nav aria-label={copy.header.languageLabel}>
            {SUPPORTED_LOCALES.filter((item) => item !== locale).map((item) => (
              <Link key={item} href={localePath(item)} hrefLang={htmlLang(item)}>
                {getCopy(item).localeLabel}
              </Link>
            ))}
          </nav>
        </details>
        <div className="web-account-slot" data-account-host="web" aria-label={copy.account.label} />
      </header>
      <main>
        <section className="doodle-main" aria-label={copy.seo.title}>
          <MobileAppWorkspace locale={locale} copy={copy} initialScene={initialScene} initialSuggestionIds={initialSuggestionIds} />
        </section>
        <section className="seo-content">
          <div className="seo-intro">
            <h2>{copy.seo.introTitle}</h2>
            <p>{copy.seo.introBody}</p>
          </div>
          <div>
            <h2>{copy.seo.howTitle}</h2>
            <ol>
              {copy.seo.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
          <div>
            <h2>{copy.seo.useTitle}</h2>
            <p>{copy.seo.useBody}</p>
          </div>
          <div>
            <h2>{ideasCopy.moreTitle}</h2>
            <p>{ideasCopy.moreBody}</p>
            <Link href={ideasPath(locale)}>{ideasCopy.browse}</Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <nav aria-label="Legal">
          <Link href={getEditorialPath(locale, "blog")}>{editorialCopy.nav.blog}</Link>
          <Link href={getEditorialPath(locale, "for-ai")}>{editorialCopy.nav.forAi}</Link>
          <Link href="/privacy">{copy.footer.privacy}</Link>
          <Link href="/terms">{copy.footer.terms}</Link>
          <Link href="/refund">{copy.footer.refunds}</Link>
          <Link href="/contact">{copy.footer.contact}</Link>
        </nav>
        <nav aria-label={copy.footer.social}>
          <a href="https://x.com/TheXSami" target="_blank" rel="noreferrer">{copy.footer.followX}</a>
        </nav>
        <span>© {new Date().getUTCFullYear()} Doodle</span>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
