"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { IDEA_IMAGES, type IdeasCopy } from "@/lib/doodle-ideas";
import { type Locale, localePath } from "@/lib/i18n";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selected = selectedIndex === null ? null : { prompt: copy.featured[selectedIndex], image: IDEA_IMAGES[selectedIndex] };

  useEffect(() => {
    if (selectedIndex !== null) dialogRef.current?.showModal();
  }, [selectedIndex]);

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
        <dialog ref={dialogRef} className="idea-dialog" aria-label={selected.prompt} onCancel={(event) => { event.preventDefault(); setSelectedIndex(null); }} onClick={(event) => { if (event.target === event.currentTarget) setSelectedIndex(null); }}>
          <div className="idea-dialog-card">
            <button className="idea-dialog-close" type="button" onClick={() => setSelectedIndex(null)} aria-label={copy.close}>×</button>
            <Image src={selected.image} alt={selected.prompt} width={900} height={900} />
            <div>
              <p>{selected.prompt}</p>
              <Link href={ideaUrl(locale, selected.prompt, attribution)}>{copy.tryIdea}</Link>
              <a href={selected.image} target="_blank" rel="noreferrer">{copy.openTab}</a>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
