import Link from "next/link";
import { LandingExamples } from "./landing-examples";
import { getGalleryItems } from "@/lib/gallery-catalog";
import { getGalleryCopy } from "@/lib/gallery-copy";
import type { DetailLevel } from "@/lib/generation/detail-level";
import { MobileAppWorkspace } from "./mobile-app-workspace";
import { AndroidAppLink } from "./discovery-links";
import { getLandingResources } from "@/lib/landing-resources";
import {
  SITE_URL,
  type Locale,
  getCopy,
  htmlLang,
  localePath,
} from "@/lib/i18n";
import { ideasPath, getDoodleIdeas } from "@/lib/doodle-ideas";
import { ARTICLE_SLUGS, getEditorialCopy, getEditorialPath } from "@/lib/editorial";
import { DEFAULT_SUGGESTION_IDS, type SceneIdeaId } from "@/lib/scenes/suggestions";
import { getLandingCopy } from "@/lib/landing-copy";
import { LanguageSwitcher } from "./language-switcher";
import "./doodle-landing.css";

export function DoodlePage({
  locale,
  initialScene = "",
  initialDetailLevel,
  initialSuggestionIds = DEFAULT_SUGGESTION_IDS,
  initialInstalled = false,
}: {
  locale: Locale;
  initialScene?: string;
  initialDetailLevel?: DetailLevel;
  initialSuggestionIds?: readonly SceneIdeaId[];
  initialInstalled?: boolean;
}) {
  const copy = getCopy(locale);
  const editorialCopy = getEditorialCopy(locale);
  const landing = getLandingCopy(locale);
  const gallery = getGalleryCopy(locale);
  const ideas = getDoodleIdeas(locale);
  const catalog = getGalleryItems(locale);
  const examples = ["birthday-dog-simple", "cooking-medium", "bookshop-detailed"].map(id => catalog.find(item => item.id === id)!);
  const supporting = getLandingResources(locale);
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
        <section id="doodle-tool" className="doodle-main" aria-label={copy.seo.title} tabIndex={-1}>
          <MobileAppWorkspace webPacksEnabled={process.env.STRIPE_PACKS_CHECKOUT_ENABLED === "true"} locale={locale} copy={copy} initialScene={initialScene} initialDetailLevel={initialDetailLevel} initialSuggestionIds={initialSuggestionIds} initialInstalled={initialInstalled} />
        </section>
        <section className="landing-afterword">
          <div>
            <h2>{landing.momentTitle}</h2>
            <p>{landing.momentBody}</p>
          </div>
          <LandingExamples items={examples} locale={locale} alt={landing.showcaseAlt} labels={{ viewLarger: ideas.viewLarger, tryIdea: ideas.tryIdea, openTab: ideas.openTab }} />
        </section>
        <section className="landing-next-step" aria-labelledby="landing-next-step-title">
          <h2 id="landing-next-step-title">{gallery.invitation}</h2>
          <div className="landing-next-actions">
            <Link className="primary-action landing-create-link" href={ideasPath(locale)}>{supporting.exploreIdeas}</Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="landing-footer-main">
          <div className="landing-footer-brand">
          <Link className="doodle-wordmark" href={localePath(locale)} aria-label={copy.header.homeLabel} dir="ltr">Doodle<span aria-hidden="true">.</span></Link>
          <AndroidAppLink locale={locale} />
          </div>
          <nav aria-label="Legal">
            <Link href="/privacy">{copy.footer.privacy}</Link>
            <Link href="/terms">{copy.footer.terms}</Link>
            <Link href="/contact">{copy.footer.contact}</Link>
          </nav>
        </div>
        <nav className="landing-footer-guides" aria-label={editorialCopy.nav.blog}>
          {ARTICLE_SLUGS.map((slug, index) => <Link key={slug} href={getEditorialPath(locale, "blog", slug)}>{supporting.guides[index]}</Link>)}
        </nav>
        <div className="landing-footer-secondary">
        <nav aria-label="Doodle">
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
