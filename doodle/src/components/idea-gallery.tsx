"use client";

/* eslint-disable @next/next/no-img-element -- prebuilt responsive WebP avoids runtime image transformation. */
import { useState, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import type { GalleryItem } from "@/lib/gallery-catalog";
import { DETAIL_LEVELS, type DetailLevel } from "@/lib/generation/detail-level";
import { getDetailLevelCopy } from "@/lib/detail-level-copy";
import { readGalleryDetail } from "@/lib/gallery-navigation";
import { IdeaPreview, type IdeaPreviewLabels } from "./idea-preview";

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("doodle:location", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("doodle:location", callback);
  };
}
const getLocationSearch = () => window.location.search;
const getServerLocationSearch = () => "";

export function IdeaGallery({ locale, items, labels }: { locale: Locale; items: GalleryItem[]; labels: IdeaPreviewLabels & { all: string } }) {
  // Render every example on the server, then apply URL filtering after hydration.
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const detail = readGalleryDetail(search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find(item => item.id === selectedId);
  const details = getDetailLevelCopy(locale);
  const visible = detail === "all" ? items : items.filter(item => item.detailLevel === detail);

  function filter(level: DetailLevel | "all") {
    if (detail === level) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("detail");
    if (level !== "all") url.searchParams.set("detail", level);
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new Event("doodle:location"));
  }

  return <>
    <div className="ideas-filter" role="group" aria-label={details.label}>
      {(["all", ...DETAIL_LEVELS] as const).map(level => <button key={level} type="button" aria-pressed={detail === level} onClick={() => filter(level)}>{level === "all" ? labels.all : details.levels[level]}</button>)}
    </div>
    <div className="ideas-grid">
      {visible.map((item, index) => <article className="idea-card" key={item.id}>
        <button type="button" className="idea-image-button" onClick={() => setSelectedId(item.id)} aria-label={`${labels.viewLarger}: ${item.caption}`}>
          <img src={`${item.thumbnail}-320.webp`} srcSet={`${item.thumbnail}-320.webp 320w, ${item.thumbnail}-640.webp 640w`} sizes="(max-width: 699px) calc((100vw - 56px) / 2), (max-width: 1099px) calc((100vw - 88px) / 3), (max-width: 1219px) calc((100vw - 136px) / 4), 271px" width={item.width} height={item.height} loading={index < 2 ? "eager" : "lazy"} decoding="async" alt={item.caption} />
        </button>
        <div className="idea-card-copy"><p>{item.caption}</p><span className="idea-detail">{details.levels[item.detailLevel]}</span></div>
      </article>)}
    </div>
    {selected ? <IdeaPreview key={selected.id} item={selected} locale={locale} labels={labels} onClose={() => setSelectedId(null)} /> : null}
  </>;
}
