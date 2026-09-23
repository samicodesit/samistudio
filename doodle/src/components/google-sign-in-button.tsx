"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

const GOOGLE_LOCALE: Record<Locale, string> = {
  en: "en", nl: "nl", de: "de", fr: "fr", es: "es", "pt-br": "pt_BR", it: "it", ja: "ja", ko: "ko", ar: "ar",
};
const GOOGLE_WIDGET_FAILURE_TIMEOUT_MS = 5_000;
type GoogleWidgetStatus = "loading" | "ready" | "error";

interface GoogleSignInButtonProps {
  locale: Locale;
  busy: boolean;
  loadingLabel?: string;
  onCredential: (credential: string) => void;
  onError: () => void;
  redirect?: boolean;
}

function isVisible(element: Element) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

function hasUsableGoogleControl(element: HTMLElement) {
  const iframe = element.querySelector("iframe");
  if (iframe) return isVisible(iframe);

  // GSI can leave an accessible DOM fallback in browsers where its iframe
  // cannot be used. It is safe to reveal that fallback only when no iframe
  // exists at all; an iframe that is still 0x0 is the transient handoff state.
  const fallback = element.querySelector('[role="button"]');
  return fallback ? isVisible(fallback) : false;
}

export function GoogleSignInButton({ locale, busy, loadingLabel = "Loading sign-in…", onCredential, onError, redirect = false }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const rendered = useRef("");
  const credential = useRef(onCredential);
  const error = useRef(onError);
  const statusRef = useRef<GoogleWidgetStatus>("loading");
  const failureTimer = useRef<number | undefined>(undefined);
  const fallbackFrame = useRef<number | undefined>(undefined);
  const [status, setStatusState] = useState<GoogleWidgetStatus>("loading");

  const setStatus = useCallback((next: GoogleWidgetStatus) => {
    if (statusRef.current === "error" && next !== "error") return;
    statusRef.current = next;
    setStatusState(next);
    if (next !== "loading" && failureTimer.current !== undefined) {
      window.clearTimeout(failureTimer.current);
      failureTimer.current = undefined;
    }
  }, []);

  useEffect(() => {
    credential.current = onCredential;
    error.current = onError;
  }, [onCredential, onError]);

  const reportError = useCallback(() => {
    if (statusRef.current === "error") return;
    setStatus("error");
    error.current();
  }, [setStatus]);

  const armFailureTimer = useCallback(() => {
    if (failureTimer.current !== undefined) window.clearTimeout(failureTimer.current);
    failureTimer.current = window.setTimeout(() => {
      failureTimer.current = undefined;
      if (statusRef.current === "loading") reportError();
    }, GOOGLE_WIDGET_FAILURE_TIMEOUT_MS);
  }, [reportError]);

  const confirmFallback = useCallback(() => {
    if (fallbackFrame.current !== undefined) return;
    if (typeof window.requestAnimationFrame !== "function") {
      setStatus("ready");
      return;
    }
    fallbackFrame.current = window.requestAnimationFrame(() => {
      fallbackFrame.current = undefined;
      const element = container.current;
      if (!element || statusRef.current === "error") return;
      if (hasUsableGoogleControl(element)) {
        setStatus("ready");
        return;
      }
      setStatus("loading");
      if (failureTimer.current === undefined) armFailureTimer();
    });
  }, [armFailureTimer, setStatus]);

  const checkReady = useCallback(() => {
    const element = container.current;
    if (!element) return;
    if (statusRef.current === "error") return;
    const iframe = element.querySelector("iframe");
    if (iframe && isVisible(iframe)) {
      setStatus("ready");
      return;
    }
    if (!iframe) {
      const fallback = element.querySelector('[role="button"]');
      if (fallback && isVisible(fallback)) {
        confirmFallback();
        return;
      }
    }
    setStatus("loading");
    if (failureTimer.current === undefined) armFailureTimer();
  }, [armFailureTimer, confirmFallback, setStatus]);

  const renderButton = useCallback(() => {
    armFailureTimer();
    const api = window.google?.accounts.id;
    const element = container.current;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!api || !element || !clientId) return;
    if (!initialized.current) {
      api.initialize(redirect ? {
        client_id: clientId,
        ux_mode: "redirect",
        login_uri: "https://doodle.samistudio.nl/api/auth/google/redirect",
      } : {
        client_id: clientId,
        callback: ({ credential: token }) => token ? credential.current(token) : error.current(),
        use_fedcm_for_prompt: true,
      });
      initialized.current = true;
    }
    const width = Math.max(1, Math.floor(element.clientWidth));
    const renderKey = `${locale}:${width}`;
    if (rendered.current === renderKey) {
      checkReady();
      return;
    }
    setStatus("loading");
    element.replaceChildren();
    api.renderButton(element, {
      type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "left",
      width, locale: GOOGLE_LOCALE[locale],
    });
    rendered.current = renderKey;
    checkReady();
  }, [armFailureTimer, checkReady, locale, redirect, setStatus]);

  useEffect(() => {
    renderButton();
    const element = container.current;
    if (!element) return;

    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === element)) renderButton();
      checkReady();
    });
    const observeIframe = () => {
      const iframe = element.querySelector("iframe");
      if (iframe) resizeObserver?.observe(iframe);
    };
    const mutationObserver = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => {
      observeIframe();
      checkReady();
    });

    resizeObserver?.observe(element);
    observeIframe();
    mutationObserver?.observe(element, {
      attributes: true,
      attributeFilter: ["height", "style", "width"],
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (failureTimer.current !== undefined) {
        window.clearTimeout(failureTimer.current);
        failureTimer.current = undefined;
      }
      if (fallbackFrame.current !== undefined) {
        window.cancelAnimationFrame(fallbackFrame.current);
        fallbackFrame.current = undefined;
      }
    };
  }, [checkReady, renderButton]);

  useEffect(() => {
    if (container.current) container.current.inert = status !== "ready";
  }, [status]);

  return (
    <div className={`google-sign-in ${busy ? "is-busy" : ""}`} aria-busy={status === "loading" || busy}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderButton} onError={reportError} />
      {status === "loading" ? <div className="google-sign-in-loading" role="status" aria-live="polite">{loadingLabel}</div> : null}
      <div ref={container} className="google-sign-in-control" aria-hidden={status !== "ready" ? "true" : "false"} />
    </div>
  );
}
