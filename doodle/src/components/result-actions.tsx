"use client";

import { Download, Plus, RotateCcw, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { track } from "@vercel/analytics";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { doodleShareUrl, SHARE_COPY } from "@/lib/sharing";

interface ResultActionsProps {
  imageUrl: string;
  imageFile: File;
  locale: Locale;
  onTryAgain: () => void;
  onNewScene: () => void;
  copy: DoodleCopy["actions"];
}

export function ResultActions({ imageUrl, imageFile, locale, onTryAgain, onNewScene, copy }: ResultActionsProps) {
  const [feedback, setFeedback] = useState<"copied" | "manual" | null>(null);
  const [sharing, setSharing] = useState(false);
  const inFlight = useRef(false);
  const shareCopy = SHARE_COPY[locale];
  const shareUrl = doodleShareUrl(locale);

  async function shareDoodle() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSharing(true);
    setFeedback(null);
    try {
      if (typeof navigator.share === "function") {
        const data: ShareData = { title: "Doodle", text: shareCopy.text, url: shareUrl };
        try {
          const fileData = { ...data, files: [imageFile] };
          if (navigator.canShare?.({ files: [imageFile] }) && navigator.canShare(fileData)) data.files = [imageFile];
          // The file is prepared during generation, preserving the click's user activation.
          await navigator.share(data);
          track("Doodle Shared", { method: data.files ? "file" : "link", locale });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(shareUrl);
        setFeedback("copied");
        track("Doodle Share Link Copied", { locale });
      } catch {
        setFeedback("manual");
      }
    } finally {
      inFlight.current = false;
      setSharing(false);
    }
  }

  return (
    <div className="result-actions">
      <div className="result-save-actions">
        <a className="primary-action" href={imageUrl} download="doodle.png" onClick={() => track("Doodle Downloaded", { locale })}>
          <Download size={16} aria-hidden="true" />
          {copy.download}
        </a>
        <button className="share-action" type="button" onClick={() => void shareDoodle()} disabled={sharing}>
          <Share2 size={16} aria-hidden="true" />
          {shareCopy.share}
        </button>
      </div>
      {feedback ? <p className="share-feedback" role="status">{shareCopy[feedback]}</p> : null}
      {feedback === "manual" ? <input className="share-link" aria-label={shareCopy.link} value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /> : null}
      <div className="secondary-actions">
        <button type="button" onClick={onTryAgain}>
          <RotateCcw size={15} aria-hidden="true" />
          {copy.tryAgain}
        </button>
        <button type="button" onClick={onNewScene}>
          <Plus size={16} aria-hidden="true" />
          {copy.newScene}
        </button>
      </div>
    </div>
  );
}
