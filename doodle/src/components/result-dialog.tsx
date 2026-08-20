"use client";

/* eslint-disable @next/next/no-img-element -- generated images are browser-owned object URLs. */
import { Download, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ResultDialogProps {
  imageUrl: string;
  open: boolean;
  onClose: () => void;
}

export function ResultDialog({ imageUrl, open, onClose }: ResultDialogProps) {
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
      aria-label="Doodle image viewer"
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
          <button className="icon-button" type="button" data-dialog-close onClick={onClose} aria-label="Close image">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="result-dialog-viewport">
          <img className="result-dialog-image" src={imageUrl} alt="Sticky-note doodle" />
        </div>
        <div className="result-dialog-actions">
          <a className="dialog-secondary-action" href={imageUrl} target="_blank" rel="noreferrer">
            View at 100%
          </a>
          <a className="dialog-download-action" href={imageUrl} download="doodle.png">
            <Download size={16} aria-hidden="true" />
            Download
          </a>
        </div>
      </div>
    </dialog>
  );
}
