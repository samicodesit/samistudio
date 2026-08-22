import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/i18n";

export const CONTACT_EMAIL = "samicodesit@gmail.com";

export function legalMetadata(path: string, title: string, description: string): Metadata {
  const canonical = `${SITE_URL}/${path}`;
  return {
    title: `${title} | Doodle`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url: canonical, siteName: "Doodle", title: `${title} | Doodle`, description },
  };
}

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <header className="doodle-header">
        <Link className="doodle-wordmark" href="/" aria-label="Doodle home">
          Doodle<span aria-hidden="true">.</span>
        </Link>
        <Link className="legal-home-link" href="/">Back to Doodle</Link>
      </header>
      <main className="legal-main">
        <article className="legal-document">
          <p className="eyebrow">Sami Studio · Slovakia</p>
          <h1>{title}</h1>
          <p className="legal-intro">{intro}</p>
          <p className="legal-updated">Last updated August 22, 2026</p>
          {children}
        </article>
        <nav className="legal-nav" aria-label="Legal pages">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refunds</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </main>
    </>
  );
}

export function ContactEmail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
