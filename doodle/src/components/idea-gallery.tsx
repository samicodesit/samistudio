"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore, type ComponentProps } from "react";
import { IDEA_IMAGES, type IdeasCopy } from "@/lib/doodle-ideas";
import { type Locale, getCopy, localePath } from "@/lib/i18n";
import { DoodlePreviewDialog } from "./doodle-preview-dialog";
import { readSafeAttribution, serializeSafeAttribution, type SafeAttribution } from "./doodle-analytics";

function subscribeToLocation() {
  return () => {};
}

function getLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return "";
}

function withSafeAttribution(href: string, attribution: SafeAttribution) {
  const safeSearch = serializeSafeAttribution(attribution);
  if (!safeSearch) return href;
  const hashIndex = href.indexOf("#");
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  return `${path}${path.includes("?") ? "&" : "?"}${safeSearch}${hash}`;
}

type AttributionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function AttributionLink({ href, ...props }: AttributionLinkProps) {
  const locationSearch = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const attribution = readSafeAttribution(locationSearch);
  return <Link {...props} href={withSafeAttribution(href, attribution)} />;
}

function ideaUrl(locale: Locale, prompt: string, attribution: SafeAttribution) {
  const safeSearch = serializeSafeAttribution(attribution);
  return `${localePath(locale)}?scene=${encodeURIComponent(prompt)}${safeSearch ? `&${safeSearch}` : ""}#composer`;
}

export function IdeaGallery({ locale, copy }: { locale: Locale; copy: IdeasCopy }) {
  const locationSearch = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const attribution = readSafeAttribution(locationSearch);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : { prompt: copy.featured[selectedIndex], image: IDEA_IMAGES[selectedIndex] };

  return (
    <>
      <div className="ideas-grid">
        {copy.featured.map((prompt, index) => (
          <article className="idea-card" key={prompt}>
            <button type="button" className="idea-image-button" onClick={() => setSelectedIndex(index)} aria-label={`${copy.viewLarger}: ${prompt}`}>
              <Image src={IDEA_IMAGES[index]} alt={prompt} width={900} height={900} priority={index < 2} />
              <span aria-hidden="true">{copy.viewLarger}</span>
            </button>
            <div className="idea-card-copy">
              <p>{prompt}</p>
              <Link href={ideaUrl(locale, prompt, attribution)}>{copy.tryIdea}</Link>
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <DoodlePreviewDialog key={selected.image} open imageUrl={selected.image} imageAlt={selected.prompt} label={selected.prompt} locale={locale} copy={getCopy(locale).dialog} onClose={() => setSelectedIndex(null)} footer={<>
          <p className="doodle-preview-caption">{selected.prompt}</p>
          <Link className="dialog-download-action" href={ideaUrl(locale, selected.prompt, attribution)}>{copy.tryIdea}</Link>
          <a className="dialog-secondary-action" href={selected.image} target="_blank" rel="noreferrer">{copy.openTab}</a>
        </>} />
      ) : null}
    </>
  );
}
