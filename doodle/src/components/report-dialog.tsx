"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { REPORT_COPY } from "@/lib/reports/report-copy";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports/report-types";
import { prepareReportImage } from "@/lib/reports/prepare-report-image";

interface ReportDialogProps {
  open: boolean;
  imageFile: File;
  scene: string;
  locale: Locale;
  onClose: () => void;
}

export function ReportDialog({ open, imageFile, scene, locale, onClose }: ReportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const copy = REPORT_COPY[locale];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const frame = requestAnimationFrame(() => dialog.querySelector<HTMLElement>("[data-report-focus]")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
    };
  }, [open]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || (reason === "other" && !details.trim()) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const content = includeContent ? await prepareReportImage(imageFile) : null;
      const response = await fetch("/api/reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          details,
          locale,
          includeContent,
          ...(content ? { scene, imageBase64: content.base64 } : {}),
        }),
      });
      if (!response.ok) throw new Error("report_failed");
      const body = (await response.json()) as { id?: unknown };
      if (typeof body.id !== "string" || !body.id) throw new Error("report_failed");
      setReportId(body.id);
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="report-dialog"
      aria-labelledby="report-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="report-dialog-card">
        <h2 id="report-dialog-title">{copy.title}</h2>
        {reportId ? (
          <div className="report-success" role="status">
            <p><strong>{copy.success}</strong></p>
            <p>{copy.reference}: <code>{reportId}</code></p>
            <button className="purchase-primary" type="button" data-report-focus onClick={onClose}>{copy.close}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p>{copy.intro}</p>
            <label htmlFor="report-reason">{copy.reasonLabel}</label>
            <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value as ReportReason | "")} disabled={busy} data-report-focus>
              <option value="">{copy.chooseReason}</option>
              {REPORT_REASONS.map((value) => <option key={value} value={value}>{copy.reasons[value]}</option>)}
            </select>

            <label htmlFor="report-details">{reason === "other" ? copy.detailsRequired : copy.detailsOptional}</label>
            <textarea id="report-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} placeholder={copy.detailsPlaceholder} disabled={busy} />

            <label className="report-consent">
              <input type="checkbox" checked={includeContent} onChange={(event) => setIncludeContent(event.target.checked)} disabled={busy} />
              <span>{copy.includeContent}</span>
            </label>

            {error ? <p className="purchase-error" role="alert">{error}</p> : null}
            <div className="report-dialog-actions">
              <button className="purchase-secondary" type="button" onClick={onClose} disabled={busy}>{copy.cancel}</button>
              <button className={`purchase-primary${busy ? " is-loading" : ""}`} type="submit" disabled={!reason || (reason === "other" && !details.trim()) || busy} aria-busy={busy}>{copy.submit}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
