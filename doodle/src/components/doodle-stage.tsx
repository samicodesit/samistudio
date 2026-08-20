"use client";

/* eslint-disable @next/next/no-img-element -- generated images are browser-owned object URLs. */
import Image from "next/image";
import { useEffect, useState } from "react";
import type { DoodleCopy } from "@/lib/i18n";

type StageStatus = "idle" | "generating" | "ready" | "error";

interface DoodleStageProps {
  status: StageStatus;
  imageUrl: string | null;
  error: string | null;
  onInspect?: () => void;
  copy: DoodleCopy["stage"];
}

const LOADING_DELAYS = [8000, 12000, 25000, 30000];

export function DoodleStage({ status, imageUrl, error, onInspect, copy }: DoodleStageProps) {
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    if (status !== "generating") return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let messageIndex = 0;
    const advanceMessage = () => {
      if (messageIndex >= LOADING_DELAYS.length) return;
      timeout = setTimeout(() => {
        messageIndex += 1;
        setLoadingMessageIndex(messageIndex);
        advanceMessage();
      }, LOADING_DELAYS[messageIndex]);
    };

    advanceMessage();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [status]);

  if (status === "generating") {
    return (
      <div className="doodle-stage doodle-stage-loading" role="status" aria-live="polite">
        <div className="loading-note" aria-hidden="true">
          <span className="loading-ink-line loading-ink-line-one" />
          <span className="loading-ink-line loading-ink-line-two" />
          <span className="loading-ink-line loading-ink-line-three" />
        </div>
        <span className="loading-primary">{copy.loadingPrimary}</span>
        <span className="loading-message" aria-hidden="true">
          {copy.loadingMessages[loadingMessageIndex]}
        </span>
        <span className="sr-only">{copy.loadingSr}</span>
      </div>
    );
  }

  if (status === "ready" && imageUrl) {
    return (
      <button className="doodle-stage doodle-stage-result" type="button" onClick={onInspect} aria-label={copy.viewLarger}>
        <img src={imageUrl} alt={copy.generatedAlt} />
        <span className="stage-inspect-label">{copy.viewLarger}</span>
      </button>
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
      aria-label={copy.referenceAria}
    >
      <Image
        src="/references/doodle-reference-kiss.png"
        alt={copy.referenceAlt}
        width={1024}
        height={1024}
        priority
      />
      <span className="stage-inspect-label">{copy.viewLarger}</span>
    </button>
  );
}
