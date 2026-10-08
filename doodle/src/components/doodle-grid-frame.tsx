"use client";

import { Grid2X2 } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { GRID_COPY, GRID_FADE_MS, GRID_LINE_COLOR } from "@/lib/grid-copy";
import type { Locale } from "@/lib/i18n";
import { GridOverlay } from "./grid-overlay";

interface DoodleGridFrameProps {
  children: ReactNode;
  locale?: Locale;
  enabled?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function DoodleGridFrame({ children, locale = "en", enabled, onToggle, className = "" }: DoodleGridFrameProps) {
  const [localEnabled, setLocalEnabled] = useState(false);
  const active = enabled ?? localEnabled;
  const label = GRID_COPY[locale][active ? "hide" : "show"];

  return (
    <div className={`doodle-grid-frame ${className}`} style={{ "--grid-fade": `${GRID_FADE_MS}ms`, "--grid-line-color": GRID_LINE_COLOR } as CSSProperties}>
      {children}
      <GridOverlay enabled={active} />
      <button type="button" className="grid-toggle" aria-pressed={active} aria-label={label} title={label} onClick={onToggle ?? (() => setLocalEnabled(value => !value))}>
        <Grid2X2 size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
