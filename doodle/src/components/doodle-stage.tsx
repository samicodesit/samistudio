"use client";

/* eslint-disable @next/next/no-img-element -- generated images are browser-owned object URLs. */
import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { DoodleWaitingCard } from "./doodle-waiting-card";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { DoodleGridFrame } from "./doodle-grid-frame";

type StageStatus = "idle" | "generating" | "ready" | "error";

interface DoodleStageProps {
  status: StageStatus;
  imageUrl: string | null;
  error: string | null;
  onInspect?: () => void;
  copy: DoodleCopy["stage"];
  referenceImage?: string;
  referenceAlt?: string;
  locale?: Locale;
  gridEnabled?: boolean;
  onToggleGrid?: () => void;
}

export function DoodleStage({ status, imageUrl, error, onInspect, copy, referenceImage, referenceAlt, locale = "en", gridEnabled = false, onToggleGrid }: DoodleStageProps) {
  if (status === "generating") return <DoodleWaitingCard copy={copy} />;

  if (status === "ready" && imageUrl) {
    return (
      <DoodleGridFrame className="grid-result-wrap" locale={locale} enabled={gridEnabled} onToggle={onToggleGrid}>
      <button className="doodle-stage doodle-stage-result" type="button" onClick={onInspect} aria-label={copy.viewLarger}>
        <img src={imageUrl} alt={copy.generatedAlt} />
        <span className="stage-inspect-label" aria-hidden="true"><Maximize2 size={20} /></span>
      </button>
      </DoodleGridFrame>
    );
  }

  if (status === "error") {
    return (
      <div className="doodle-stage doodle-stage-error" role="alert">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <button
      className="doodle-stage doodle-stage-reference doodle-stage-result"
      type="button"
      onClick={onInspect}
      aria-label={referenceAlt ?? copy.referenceAria}
    >
      <Image
        src={referenceImage ?? "/references/doodle-reference-kiss.png"}
        alt={referenceAlt ?? copy.referenceAlt}
        width={1024}
        height={1024}
        sizes={referenceImage ? "(max-width: 699px) calc(100vw - 40px), 280px" : undefined}
        priority
      />
      <span className="stage-inspect-label" aria-hidden="true"><Maximize2 size={20} /></span>
    </button>
  );
}
