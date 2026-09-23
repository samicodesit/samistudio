"use client";

import { CreditCard, Download, Ellipsis, Flag, Plus, RotateCcw, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { getCopy } from "@/lib/i18n";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { doodleShareUrl, SHARE_COPY } from "@/lib/sharing";
import { ReportDialog } from "./report-dialog";
import { REPORT_COPY } from "@/lib/reports/report-copy";
import { CardComposer } from "./card-composer";

interface ResultActionsProps {
  imageUrl: string;
  imageFile: File;
  scene: string;
  locale: Locale;
  onTryAgain: () => void;
  onNewScene: () => void;
  copy: DoodleCopy["actions"];
}

const MORE_LABEL: Record<Locale, string> = {
  en: "More options", nl: "Meer opties", de: "Weitere Optionen", fr: "Plus d’options",
  es: "Más opciones", "pt-br": "Mais opções", it: "Altre opzioni", ja: "その他の操作", ko: "추가 옵션", ar: "المزيد من الخيارات",
};

export function ResultActions({ imageUrl, imageFile, scene, locale, onTryAgain, onNewScene, copy }: ResultActionsProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const optionsRef = useRef<HTMLDialogElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState<"copied" | "manual" | null>(null);
  const [sharing, setSharing] = useState(false);
  const inFlight = useRef(false);
  const shareCopy = SHARE_COPY[locale];
  const shareUrl = doodleShareUrl(locale);
  const cardCopy = getCopy(locale).card;

  useEffect(() => {
    if (!optionsOpen) return;
    const dialog = optionsRef.current;
    const trigger = moreRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); trigger?.focus(); };
  }, [optionsOpen]);

  function closeOptions() {
    if (typeof optionsRef.current?.close === "function") optionsRef.current.close();
    moreRef.current?.focus();
    setOptionsOpen(false);
  }

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
        <button className="new-scene-action" type="button" onClick={onNewScene}>
          <Plus size={16} aria-hidden="true" />
          {copy.newScene}
        </button>
        <button ref={moreRef} className="result-more-button" type="button" aria-label={MORE_LABEL[locale]} aria-haspopup="dialog" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(true)}><Ellipsis size={22} aria-hidden="true" /></button>
      </div>
      {optionsOpen ? <dialog ref={optionsRef} className="result-options-dialog" aria-label={MORE_LABEL[locale]} onCancel={event => { event.preventDefault(); closeOptions(); }} onClick={event => { if (event.target === event.currentTarget) closeOptions(); }}>
        <div className="result-options-header"><h2>{MORE_LABEL[locale]}</h2><button type="button" aria-label={REPORT_COPY[locale].close} onClick={closeOptions}><X size={20} aria-hidden="true" /></button></div>
        <button type="button" onClick={() => { closeOptions(); onTryAgain(); }}><RotateCcw size={20} aria-hidden="true" />{copy.redraw}</button>
        <button type="button" onClick={() => { closeOptions(); setCardOpen(true); }}><CreditCard size={20} aria-hidden="true" />{copy.makeCard}</button>
        <button className="report-action" type="button" onClick={() => { closeOptions(); setReportOpen(true); }}><Flag size={20} aria-hidden="true" />{REPORT_COPY[locale].trigger}</button>
      </dialog> : null}
      {reportOpen ? <ReportDialog key={imageUrl} open imageFile={imageFile} scene={scene} locale={locale} onClose={() => setReportOpen(false)} /> : null}
      {cardOpen ? <CardComposer key={imageUrl} imageUrl={imageUrl} imageFile={imageFile} locale={locale} copy={cardCopy} onClose={() => setCardOpen(false)} /> : null}
    </div>
  );
}
