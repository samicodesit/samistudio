"use client";

import { Download, LoaderCircle, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import type { CardCopy, Locale } from "@/lib/i18n";
import { doodleShareUrl, SHARE_COPY } from "@/lib/sharing";
import {
  canShareCard,
  countGraphemes,
  limitCardMessage,
  renderCardBlob,
} from "@/lib/card/render-card";

interface CardComposerProps {
  imageUrl: string;
  imageFile: File;
  locale: Locale;
  copy: CardCopy;
  onClose: () => void;
}

interface CardRenderInput {
  imageFile: File;
  locale: Locale;
  message: string;
}

export function CardComposer({ imageUrl, imageFile, locale, copy, onClose }: CardComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  const outputUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const openedTrackedRef = useRef(false);
  const [message, setMessage] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [settledInput, setSettledInput] = useState<CardRenderInput | null>(null);
  const [failedInput, setFailedInput] = useState<CardRenderInput | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (!openedTrackedRef.current) {
      track("Doodle Card Opened");
      openedTrackedRef.current = true;
    }
    mountedRef.current = true;
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      mountedRef.current = false;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      trigger?.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const input: CardRenderInput = { imageFile, locale, message };

    void renderCardBlob(imageFile, message, locale).then(blob => {
      if (cancelled) return;
      const file = new File([blob], "doodle-card.png", { type: "image/png" });
      const url = URL.createObjectURL(file);
      const previousUrl = outputUrlRef.current;
      outputUrlRef.current = url;
      setOutputFile(file);
      setOutputUrl(url);
      setSettledInput(input);
      setFailedInput(null);
      if (previousUrl && previousUrl !== url) URL.revokeObjectURL(previousUrl);
    }).catch(() => {
      if (!cancelled) {
        setFailedInput(input);
      }
    });

    return () => { cancelled = true; };
  }, [imageFile, locale, message]);

  useEffect(() => () => {
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
  }, []);

  const inputMatches = (input: CardRenderInput | null) => input?.imageFile === imageFile && input.locale === locale && input.message === message;
  const preparing = !inputMatches(settledInput) && !inputMatches(failedInput);
  const error = inputMatches(failedInput);

  function close() {
    onClose();
  }

  function downloadCard() {
    if (!outputUrl || preparing || error) return;
    track("Doodle Card Download Requested");
    const link = document.createElement("a");
    link.href = outputUrl;
    link.download = "doodle-card.png";
    link.click();
  }

  async function shareCard() {
    if (!outputFile || preparing || error || sharing) return;
    const shareData: ShareData = {
      title: "Doodle card",
      text: SHARE_COPY[locale].text,
      url: doodleShareUrl(locale),
      files: [outputFile],
    };
    if (!canShareCard(shareData)) {
      return;
    }
    setSharing(true);
    setShareError(false);
    try {
      await navigator.share(shareData);
      if (mountedRef.current) track("Doodle Card Shared");
    } catch (shareError) {
      if (mountedRef.current && (!(shareError instanceof DOMException) || shareError.name !== "AbortError")) setShareError(true);
    } finally {
      if (mountedRef.current) setSharing(false);
    }
  }

  const shareData: ShareData | null = outputFile ? {
    title: "Doodle card",
    text: SHARE_COPY[locale].text,
    url: doodleShareUrl(locale),
    files: [outputFile],
  } : null;
  const canShare = shareData ? canShareCard(shareData) : false;

  return (
    <dialog
      ref={dialogRef}
      className="result-dialog card-composer-dialog"
      aria-labelledby="card-composer-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="result-dialog-card card-composer-card" dir={locale === "ar" ? "rtl" : "ltr"}>
        <div className="result-dialog-header card-composer-header">
          <div>
            <p className="result-dialog-kicker">Doodle</p>
            <h2 ref={titleRef} id="card-composer-title" tabIndex={-1}>{copy.title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label={copy.close} onClick={close}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="card-composer-layout">
          <div className={`card-preview${outputUrl ? " is-rendered" : ""}`} aria-label={copy.previewAlt}>
            {outputUrl ? <img className="card-preview-rendered" src={outputUrl} alt={copy.previewAlt} /> : <>
              <div className="card-preview-image"><img src={imageUrl} alt={copy.previewAlt} /></div>
              <p className="card-preview-message">{message}</p>
            </>}
          </div>
          <div className="card-composer-controls" aria-busy={preparing}>
            <label htmlFor="card-message">{copy.messageLabel}</label>
            <textarea
              id="card-message"
              value={message}
              placeholder={copy.messagePlaceholder}
              onChange={event => {
                setShareError(false);
                setMessage(limitCardMessage(event.currentTarget.value));
              }}
              rows={3}
            />
            <p className="card-composer-hint"><span>{copy.messageHint}</span><span>{countGraphemes(message)}/80</span></p>
            <div className="card-composer-status-slot" aria-live="polite">
              {preparing ? <p className="card-composer-status" role="status"><LoaderCircle size={16} aria-hidden="true" className="card-composer-spinner" />{copy.preparing}</p> : null}
            </div>
            {error ? <p className="card-composer-error" role="alert">{copy.error}</p> : null}
            {shareError ? <p className="card-composer-error" role="alert">{copy.shareFallback}</p> : null}
            <div className={`card-composer-actions${canShare ? "" : " is-single"}`}>
              <button className="primary-action" type="button" disabled={!outputUrl || preparing || error} onClick={downloadCard}><Download size={16} aria-hidden="true" />{copy.download}</button>
              {canShare ? <button className="share-action" type="button" disabled={!outputFile || preparing || sharing} onClick={() => void shareCard()}><Share2 size={16} aria-hidden="true" />{copy.share}</button> : null}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
