"use client";

import Link from "next/link";
import type { GalleryItem } from "@/lib/gallery-catalog";
import { getCopy, localePath, type Locale } from "@/lib/i18n";
import { DoodlePreviewDialog } from "./doodle-preview-dialog";
import { readSafeAttribution, serializeSafeAttribution } from "./doodle-analytics";

export type IdeaPreviewLabels = { viewLarger: string; tryIdea: string; openTab: string };

export function IdeaPreview({ item, locale, labels, onClose }: { item: GalleryItem; locale: Locale; labels: IdeaPreviewLabels; onClose: () => void }) {
  const attribution = serializeSafeAttribution(readSafeAttribution(typeof window === "undefined" ? "" : window.location.search));
  const href = `${localePath(locale)}?scene=${encodeURIComponent(item.prompt)}&detail=${item.detailLevel}${attribution ? `&${attribution}` : ""}#doodle-tool`;
  return <DoodlePreviewDialog open imageUrl={item.image} imageAlt={item.caption} label={item.caption} locale={locale} copy={getCopy(locale).dialog} onClose={onClose} footer={<>
    <p className="doodle-preview-caption">{item.caption}</p>
    <Link className="dialog-download-action" href={href} prefetch={false} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !document.getElementById("doodle-tool")) return;
      event.preventDefault();
      onClose();
      window.dispatchEvent(new CustomEvent("doodle:try-idea", { detail: { scene: item.prompt, detailLevel: item.detailLevel } }));
      window.history.pushState(window.history.state, "", href);
      requestAnimationFrame(() => {
        document.getElementById("doodle-tool")?.scrollIntoView({ block: "start" });
        document.querySelector<HTMLTextAreaElement>("#doodle-tool textarea")?.focus({ preventScroll: true });
      });
    }}>{labels.tryIdea}</Link>
    <a className="dialog-secondary-action" href={item.image} target="_blank" rel="noreferrer">{labels.openTab}</a>
  </>} />;
}
