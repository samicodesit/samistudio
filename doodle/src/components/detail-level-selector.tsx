"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { DETAIL_LEVELS, type DetailLevel } from "@/lib/generation/detail-level";
import { getDetailLevelCopy } from "@/lib/detail-level-copy";
import type { Locale } from "@/lib/i18n";

export const DETAIL_EXAMPLES: Record<DetailLevel, string> = {
  simple: "/ideas/thumbs/birthday-dog-simple-320.webp",
  medium: "/ideas/thumbs/birthday-dog-medium-320.webp",
  detailed: "/ideas/thumbs/birthday-dog-detailed-320.webp",
};

export function DetailLevelSelector({ locale, value, disabled = false, onChange }: {
  locale: Locale; value: DetailLevel; disabled?: boolean; onChange(level: DetailLevel): void;
}) {
  const copy = getDetailLevelCopy(locale);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setExpanded(false), []);
  return <div className="detail-selector">
    <button ref={trigger} className="detail-trigger" type="button" disabled={disabled}
      aria-label={`${copy.heading}: ${copy.levels[value]}`} aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? id : undefined}
      onClick={() => setExpanded(true)}>
      <Image src={DETAIL_EXAMPLES[value]} width={38} height={38} alt="" unoptimized />
      <span className="detail-trigger-label"><small>{copy.heading}</small><strong>{copy.levels[value]}</strong></span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {expanded && !disabled ? createPortal(<DetailPicker id={id} locale={locale} value={value} onChange={onChange} onClose={close} restoreFocus={() => trigger.current?.focus({ preventScroll: true })} />, document.body) : null}
  </div>;
}

function DetailPicker({ id, locale, value, onChange, onClose, restoreFocus }: {
  id: string; locale: Locale; value: DetailLevel; onChange(level: DetailLevel): void; onClose(): void; restoreFocus(): void;
}) {
  const copy = getDetailLevelCopy(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const radios = useRef<Array<HTMLButtonElement | null>>([]);
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  const initialValue = useRef(value);
  const restore = useRef(restoreFocus);
  useEffect(() => {
    const element = dialog.current;
    const restoreFocus = restore.current;
    if (typeof element?.showModal === "function") element.showModal();
    else element?.setAttribute("open", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    radios.current[DETAIL_LEVELS.indexOf(initialValue.current)]?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (element?.open && typeof element.close === "function") element.close();
      restoreFocus();
    };
  }, []);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const backward = locale === "ar" ? "ArrowRight" : "ArrowLeft";
    const next = event.key === forward || event.key === "ArrowDown" ? (index + 1) % 3
      : event.key === backward || event.key === "ArrowUp" ? (index + 2) % 3
      : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
    if (next === null) return;
    event.preventDefault();onChange(DETAIL_LEVELS[next]);radios.current[next]?.focus();
  }
  return <dialog ref={dialog} id={id} className="detail-picker" data-closing={closing} dir={locale === "ar" ? "rtl" : "ltr"} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault();requestClose(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault();requestClose(); } }}
    onClick={event => { if(event.target === event.currentTarget) { const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) requestClose(); } }}>
    <div className="detail-picker-heading"><h2 id={`${id}-title`}>{copy.title}</h2><button className="detail-picker-close" type="button" aria-label={copy.close} onClick={requestClose}><X size={20} aria-hidden="true" /></button></div>
    <p id={`${id}-description`} className="detail-picker-description">{copy.description}</p>
    <div className="detail-options" role="radiogroup" aria-label={copy.label}>
      {DETAIL_LEVELS.map((level,index) => <button ref={node => {radios.current[index]=node;}} key={level} type="button" role="radio" aria-label={copy.levels[level]} aria-checked={value === level} disabled={closing} tabIndex={value === level ? 0 : -1} className="detail-choice" onKeyDown={event => navigate(event,index)} onClick={() => {onChange(level);requestClose();}}>
        <Image src={DETAIL_EXAMPLES[level]} width={128} height={128} alt="" unoptimized />
        <strong>{copy.levels[level]}</strong><small>{copy.descriptions[level]}</small>
        {value === level ? <span className="detail-choice-check" aria-hidden="true"><Check size={13} /></span> : null}
      </button>)}
    </div>
  </dialog>;
}
