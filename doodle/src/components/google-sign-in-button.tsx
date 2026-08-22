"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

const GOOGLE_LOCALE: Record<Locale, string> = {
  en: "en", nl: "nl", de: "de", fr: "fr", es: "es", "pt-br": "pt_BR", it: "it", ja: "ja", ko: "ko", ar: "ar",
};

interface GoogleSignInButtonProps {
  locale: Locale;
  busy: boolean;
  onCredential: (credential: string) => void;
  onError: () => void;
}

export function GoogleSignInButton({ locale, busy, onCredential, onError }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const rendered = useRef("");
  const credential = useRef(onCredential);
  const error = useRef(onError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    credential.current = onCredential;
    error.current = onError;
  }, [onCredential, onError]);

  const renderButton = useCallback(() => {
    const api = window.google?.accounts.id;
    const element = container.current;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!api || !element || !clientId) return;
    if (!initialized.current) {
      api.initialize({
        client_id: clientId,
        callback: ({ credential: token }) => token ? credential.current(token) : error.current(),
        use_fedcm_for_prompt: true,
      });
      initialized.current = true;
    }
    const width = Math.max(1, Math.floor(element.clientWidth));
    const renderKey = `${locale}:${width}`;
    if (rendered.current === renderKey) return;
    element.replaceChildren();
    api.renderButton(element, {
      type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "left",
      width, locale: GOOGLE_LOCALE[locale],
    });
    rendered.current = renderKey;
    setReady(true);
  }, [locale]);

  useEffect(() => {
    renderButton();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(renderButton);
    if (container.current) observer?.observe(container.current);
    return () => observer?.disconnect();
  }, [renderButton]);

  return (
    <div className={`google-sign-in ${busy ? "is-busy" : ""}`} aria-busy={!ready || busy}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderButton} onError={() => error.current()} />
      {!ready ? <div className="google-sign-in-loading" aria-hidden="true" /> : null}
      <div ref={container} className="google-sign-in-control" />
    </div>
  );
}
