import type { Metadata } from "next";
import Link from "next/link";
import { IdeaGallery } from "@/components/idea-gallery";
import { DOODLE_IDEAS, QUICK_DOODLE_IDEAS } from "@/lib/doodle-ideas";
import { SITE_URL } from "@/lib/i18n";

const title = "Cute Doodle Ideas for Notes, Cards & Lunchboxes | Doodle";
const description = "Browse easy, cute doodle ideas for lunchbox notes, greeting cards, journals and classrooms. Open an example or send its prompt to the AI doodle generator.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/doodle-ideas` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/doodle-ideas`,
    type: "website",
    images: [{ url: `${SITE_URL}${DOODLE_IDEAS[0].image}`, alt: DOODLE_IDEAS[0].alt }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${SITE_URL}${DOODLE_IDEAS[0].image}`],
  },
};

export default function DoodleIdeasPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SITE_URL}/doodle-ideas`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: DOODLE_IDEAS.map((idea, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "ImageObject",
          name: idea.prompt,
          contentUrl: `${SITE_URL}${idea.image}`,
          description: idea.alt,
        },
      })),
    },
  };

  return (
    <>
      <header className="doodle-header ideas-header">
        <Link className="doodle-wordmark" href="/" aria-label="Doodle home">
          Doodle<span aria-hidden="true">.</span>
        </Link>
        <Link className="ideas-header-link" href="/#composer">Make a doodle</Link>
      </header>
      <main className="ideas-page">
        <section className="ideas-hero">
          <p className="eyebrow">Doodle ideas</p>
          <h1>Small drawings for real little moments.</h1>
          <p>Copy one by hand, open it for a closer look, or use the idea as a starting point for your own doodle.</p>
        </section>

        <IdeaGallery />

        <section className="quick-ideas" aria-labelledby="quick-ideas-title">
          <div>
            <p className="eyebrow">More prompts</p>
            <h2 id="quick-ideas-title">20 more easy doodle ideas</h2>
            <p>Good prompts describe one clear moment. Keep the cast small, add one action, and leave the rest to the drawing.</p>
          </div>
          <ul>
            {QUICK_DOODLE_IDEAS.map((idea) => (
              <li key={idea}>
                <span>{idea}</span>
                <Link href={`/?scene=${encodeURIComponent(idea)}#composer`} aria-label={`Try: ${idea}`}>Try</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ideas-guide">
          <h2>What makes a doodle idea easy to draw?</h2>
          <p>Choose a familiar subject, give it one readable action, and skip the background unless it matters. “A snail delivering a birthday card” works better than a crowded party scene because the feeling survives even in a few simple lines.</p>
          <Link href="/#composer">Turn your idea into a doodle</Link>
        </section>
      </main>
      <footer className="site-footer ideas-footer">
        <nav aria-label="Doodle links">
          <Link href="/">Generator</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <span>© {new Date().getUTCFullYear()} Doodle</span>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
