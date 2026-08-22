"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DOODLE_IDEAS } from "@/lib/doodle-ideas";

type Idea = (typeof DOODLE_IDEAS)[number];

function ideaUrl(prompt: string) {
  return `/?scene=${encodeURIComponent(prompt)}#composer`;
}

export function IdeaGallery() {
  const [selected, setSelected] = useState<Idea | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!selected) return;
    dialogRef.current?.showModal();
  }, [selected]);

  return (
    <>
      <div className="ideas-grid">
        {DOODLE_IDEAS.map((idea, index) => (
          <article className="idea-card" key={idea.prompt}>
            <button type="button" className="idea-image-button" onClick={() => setSelected(idea)} aria-label={`View larger: ${idea.prompt}`}>
              <Image src={idea.image} alt={idea.alt} width={900} height={900} priority={index < 2} />
              <span aria-hidden="true">View larger</span>
            </button>
            <div className="idea-card-copy">
              <span>{idea.category}</span>
              <p>{idea.prompt}</p>
              <Link href={ideaUrl(idea.prompt)}>Try this idea</Link>
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <dialog
          ref={dialogRef}
          className="idea-dialog"
          aria-label={selected.prompt}
          onCancel={(event) => {
            event.preventDefault();
            setSelected(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div className="idea-dialog-card">
            <button className="idea-dialog-close" type="button" onClick={() => setSelected(null)} aria-label="Close">×</button>
            <Image src={selected.image} alt={selected.alt} width={900} height={900} />
            <div>
              <p>{selected.prompt}</p>
              <Link href={ideaUrl(selected.prompt)}>Try this idea</Link>
              <a href={selected.image} target="_blank" rel="noreferrer">Open image in new tab</a>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
