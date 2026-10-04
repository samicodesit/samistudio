import Link from "next/link";
import Image from "next/image";
import { MobileAppWorkspace } from "./mobile-app-workspace";
import { AndroidAppLink, DrawingGuides } from "./discovery-links";
import {
  SITE_URL,
  type Locale,
  getCopy,
  htmlLang,
  localePath,
} from "@/lib/i18n";
import { getDoodleIdeas, ideasPath } from "@/lib/doodle-ideas";
import { getEditorialCopy, getEditorialPath } from "@/lib/editorial";
import { DEFAULT_SUGGESTION_IDS, type SceneIdeaId } from "@/lib/scenes/suggestions";
import { getLandingCopy } from "@/lib/landing-copy";
import { LanguageSwitcher } from "./language-switcher";
import "./doodle-landing.css";

export function DoodlePage({
  locale,
  initialScene = "",
  initialSuggestionIds = DEFAULT_SUGGESTION_IDS,
  initialInstalled = false,
}: {
  locale: Locale;
  initialScene?: string;
  initialSuggestionIds?: readonly SceneIdeaId[];
  initialInstalled?: boolean;
}) {
  const copy = getCopy(locale);
  const ideasCopy = getDoodleIdeas(locale);
  const editorialCopy = getEditorialCopy(locale);
  const landing = getLandingCopy(locale);
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
        description: copy.usage.freeTrial,
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
    <div className="doodle-landing">
      <header className="doodle-header">
        <Link className="doodle-wordmark" href={localePath(locale)} aria-label={copy.header.homeLabel} dir="ltr">
          Doodle<span aria-hidden="true">.</span>
        </Link>
        <Link className="landing-examples-link" href={ideasPath(locale)}>{landing.examples}</Link>
        <LanguageSwitcher locale={locale} />
        <div className="web-account-slot" data-account-host="web" aria-label={copy.account.label} />
      </header>
      <main>
        <section className="doodle-main" aria-label={copy.seo.title}>
          <MobileAppWorkspace locale={locale} copy={copy} initialScene={initialScene} initialSuggestionIds={initialSuggestionIds} initialInstalled={initialInstalled} />
        </section>
        <section className="landing-afterword">
          <div>
            <h2>{landing.momentTitle}</h2>
            <p>{landing.momentBody}</p>
          </div>
          <div className="landing-example-papers">
            <Link href={ideasPath(locale)}><Image src="/landing/detail-examples.webp" alt={landing.showcaseAlt} width={1400} height={527} sizes="(max-width: 699px) calc(100vw - 40px), 480px" /></Link>
          </div>
        </section>
        <details className="landing-resources">
          <summary>{ideasCopy.guideTitle}</summary>
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
          <DrawingGuides locale={locale} />
          <AndroidAppLink locale={locale} />
        </details>
      </main>
      <footer className="site-footer">
        <div className="landing-footer-main">
          <Link className="doodle-wordmark" href={localePath(locale)} aria-label={copy.header.homeLabel} dir="ltr">Doodle<span aria-hidden="true">.</span></Link>
          <nav aria-label="Legal">
            <Link href="/privacy">{copy.footer.privacy}</Link>
            <Link href="/terms">{copy.footer.terms}</Link>
            <Link href="/contact">{copy.footer.contact}</Link>
          </nav>
        </div>
        <div className="landing-footer-secondary">
        <nav aria-label={editorialCopy.nav.blog}>
          <Link href={getEditorialPath(locale, "blog")}>{editorialCopy.nav.blog}</Link>
          <Link href={getEditorialPath(locale, "for-ai")}>{editorialCopy.nav.forAi}</Link>
          <Link href="/refund">{copy.footer.refunds}</Link>
        </nav>
        <nav aria-label={copy.footer.social}>
          <a href="https://x.com/TheXSami" target="_blank" rel="noreferrer">{copy.footer.followX}</a>
        </nav>
        <span>© {new Date().getUTCFullYear()} Doodle</span>
        </div>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
