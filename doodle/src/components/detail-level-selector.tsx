"use client";

import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { DETAIL_LEVELS, type DetailLevel } from "@/lib/generation/detail-level";
import { detailDockSwipe } from "@/lib/detail-dock";
import { getDetailLevelCopy } from "@/lib/detail-level-copy";
import type { Locale } from "@/lib/i18n";

export function DetailLevelSelector({ locale, value, disabled = false, onChange }: {
  locale: Locale; value: DetailLevel; disabled?: boolean; onChange(level: DetailLevel): void;
}) {
  const copy = getDetailLevelCopy(locale);
  const id = useId();
  const [expanded, setExpanded] = useState(true);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const toggle = useRef<HTMLButtonElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  function reveal(next: boolean) {
    if (disabled) return;
    if (!next) toggle.current?.focus({ preventScroll: true });
    setExpanded(next);
  }
  function endSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current || disabled) return;
    const next = detailDockSwipe(event.clientX - pointer.current.x, event.clientY - pointer.current.y);
    pointer.current = null;
    if (next !== null) {
      swiped.current = true;
      event.preventDefault();
      reveal(next);
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || !expanded) return;
    if (event.key === "Escape") {
      event.preventDefault();
      reveal(false);
      return;
    }
    const forward = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const backward = locale === "ar" ? "ArrowRight" : "ArrowLeft";
    let next: number;
    if (event.key === forward || event.key === "ArrowDown") next = (index + 1) % 3;
    else if (event.key === backward || event.key === "ArrowUp") next = (index + 2) % 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 2;
    else return;
    event.preventDefault();
    onChange(DETAIL_LEVELS[next]);
    buttons.current[next]?.focus();
  }
  return <div className="detail-selector" data-expanded={expanded}
    onPointerDown={event => {
      swiped.current = false;
      if (event.pointerType === "touch" || event.pointerType === "pen") pointer.current = { x: event.clientX, y: event.clientY };
    }} onPointerMove={event => {
      if (pointer.current && detailDockSwipe(event.clientX - pointer.current.x, event.clientY - pointer.current.y) !== null) {
        swiped.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }} onPointerUp={endSwipe} onPointerCancel={() => { pointer.current = null; }}>
    <div id={id} className="detail-drawer" aria-hidden={!expanded} inert={!expanded}>
      <div className="detail-tiles" role="radiogroup" aria-label={copy.label}>
        {DETAIL_LEVELS.map((level, index) => <button
          key={level} ref={node => { buttons.current[index] = node; }}
          type="button" role="radio" aria-label={copy.levels[level]} aria-checked={value === level}
          disabled={disabled || !expanded} tabIndex={value === level && expanded ? 0 : -1}
          className="detail-tile" onClick={event => { if (event.detail === 0 || !swiped.current) onChange(level); }} onKeyDown={event => navigate(event, index)}
        >
          <Image src={"/detail/" + level + ".svg"} width={56} height={56} alt="" draggable={false} />
          <span className="detail-check" aria-hidden="true">{value === level ? <Check size={10} strokeWidth={3} /> : null}</span>
          <span className="detail-tooltip" aria-hidden="true">{copy.levels[level]}</span>
        </button>)}
      </div>
    </div>
    <button ref={toggle} type="button" className="detail-toggle" disabled={disabled}
      aria-label={`${expanded ? copy.hide : copy.show} (${copy.levels[value]})`}
      aria-expanded={expanded} aria-controls={id}
      onClick={event => { if (event.detail === 0 || !swiped.current) reveal(!expanded); }}>
      <span className="detail-handle" aria-hidden="true">{expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</span>
    </button>
  </div>;
}
