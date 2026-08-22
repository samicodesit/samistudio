"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IDEA_IMAGES, type IdeasCopy } from "@/lib/doodle-ideas";
import { type Locale, localePath } from "@/lib/i18n";

function ideaUrl(locale: Locale, prompt: string) {
  return `${localePath(locale)}?scene=${encodeURIComponent(prompt)}#composer`;
}

export function IdeaGallery({ locale, copy }: { locale: Locale; copy: IdeasCopy }) {
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
              <Link href={ideaUrl(locale, prompt)}>{copy.tryIdea}</Link>
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
              <Link href={ideaUrl(locale, selected.prompt)}>{copy.tryIdea}</Link>
              <a href={selected.image} target="_blank" rel="noreferrer">{copy.openTab}</a>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
