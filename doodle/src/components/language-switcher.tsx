"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LOCALES, getCopy, htmlLang, localePath, type Locale } from "@/lib/i18n";

const FLAGS: Record<Locale, string> = { en: "gb", nl: "nl", de: "de", fr: "fr", es: "es", "pt-br": "br", it: "it", ja: "jp", ko: "kr", ar: "sa" };

function Flag({ locale }: { locale: Locale }) {
  return <Image className="language-flag" src={`/flags/${FLAGS[locale]}.svg`} width={24} height={18} alt="" unoptimized />;
}

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const copy = getCopy(locale);

  useEffect(() => {
    if (state === "closing") {
      const timer = window.setTimeout(() => setState("closed"), 180);
      return () => window.clearTimeout(timer);
    }
    if (state !== "open") return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setState("closing");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setState("closing");
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [state]);

  return <details ref={root} className="language-switcher language-switcher-animated" open={state !== "closed"} data-state={state} onBlur={(event) => {
    if (state === "open" && !event.currentTarget.contains(event.relatedTarget as Node)) setState("closing");
  }}>
    <summary ref={trigger} aria-label={copy.header.languageLabel} aria-expanded={state === "open"} onClick={(event) => {
      event.preventDefault();
      setState(state === "open" ? "closing" : "open");
    }}>
      <Flag locale={locale} />{copy.localeLabel}
    </summary>
    <nav aria-label={copy.header.languageLabel} inert={state !== "open"}>
      {SUPPORTED_LOCALES.filter((item) => item !== locale).map((item) => <Link key={item} href={localePath(item)} hrefLang={htmlLang(item)}>
        <Flag locale={item} /><span lang={htmlLang(item)}>{getCopy(item).localeLabel}</span>
      </Link>)}
    </nav>
  </details>;
}
