"use client";

/* eslint-disable @next/next/no-img-element -- generated images are browser-owned object URLs. */
import { Download, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { DoodleGridFrame } from "./doodle-grid-frame";

interface DoodlePreviewDialogProps {
  imageUrl: string;
  open: boolean;
  onClose: () => void;
  copy: DoodleCopy["dialog"];
  gridEnabled?: boolean;
  onToggleGrid?: () => void;
  locale?: Locale;
  label?: string;
  imageAlt?: string;
  footer?: ReactNode;
}

export function DoodlePreviewDialog({ imageUrl, open, onClose, copy, gridEnabled, onToggleGrid, locale = "en", label = copy.label, imageAlt = copy.imageAlt, footer }: DoodlePreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus());

    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      previousFocus.current?.focus();
      previousFocus.current = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="result-dialog"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="result-dialog-card">
        <div className="result-dialog-header result-dialog-header-compact">
          <button className="icon-button" type="button" data-dialog-close onClick={onClose} aria-label={copy.close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="result-dialog-viewport">
          <DoodleGridFrame key={imageUrl} className="result-dialog-grid-frame" locale={locale} enabled={gridEnabled} onToggle={onToggleGrid}>
            <img className="result-dialog-image" src={imageUrl} alt={imageAlt} />
          </DoodleGridFrame>
        </div>
        <div className="result-dialog-actions">
          {footer ?? <>
          <a className="dialog-secondary-action" href={imageUrl} target="_blank" rel="noreferrer">
            {copy.native}
          </a>
          <a className="dialog-download-action" href={imageUrl} download="doodle.png">
            <Download size={16} aria-hidden="true" />
            {copy.download}
          </a>
          </>}
        </div>
      </div>
    </dialog>
  );
}
