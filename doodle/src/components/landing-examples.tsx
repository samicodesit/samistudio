"use client";

import Image from "next/image";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { GalleryItem } from "@/lib/gallery-catalog";
import { IdeaPreview, type IdeaPreviewLabels } from "./idea-preview";

export function LandingExamples({ items, locale, alt, labels }: { items: GalleryItem[]; locale: Locale; alt: string; labels: IdeaPreviewLabels }) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  return <div className="landing-example-papers">
    <Image src="/landing/detail-examples.webp" alt={alt} width={1400} height={527} sizes="(max-width: 699px) calc(100vw - 40px), 480px" />
    <div className="landing-example-targets" dir="ltr">
      {items.map(item => <button key={item.id} type="button" aria-label={`${labels.viewLarger}: ${item.caption}`} onClick={() => setSelected(item)} />)}
    </div>
    {selected ? <IdeaPreview key={selected.id} item={selected} locale={locale} labels={labels} onClose={() => setSelected(null)} /> : null}
  </div>;
}
