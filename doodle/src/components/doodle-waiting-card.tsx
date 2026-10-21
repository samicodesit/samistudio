"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import type { DoodleCopy } from "@/lib/i18n";

// Mirrors NativeWaitingCard: 8s artwork, 2580ms hold + 420ms roll,
// and the same 5.4s still frame for reduced motion.
export function DoodleWaitingCard({ copy }: { copy: DoodleCopy["stage"] }) {
  const container = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [active, setActive] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [messageHeight, setMessageHeight] = useState(24);
  const messages = copy.loadingMessages;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { setReducedMotion(media.matches); setRolling(false); };
    const updateVisibility = () => { setActive(document.visibilityState !== "hidden"); setRolling(false); };
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animation: AnimationItem | undefined;
    void import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !container.current) return;
      animation = lottie.loadAnimation({
        container: container.current,
        renderer: "svg",
        loop: true,
        autoplay: false,
        path: "/animations/pencil-loader.json",
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      player.current = animation;
      animation.addEventListener("DOMLoaded", () => {
        if (!cancelled) setReady(true);
      });
      animation.addEventListener("data_failed", () => {
        if (!cancelled) setReady(false);
      });
    }).catch(() => { /* The poster and waiting copy remain usable offline. */ });
    return () => {
      cancelled = true;
      animation?.destroy();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (reducedMotion) player.current?.goToAndStop(324, true);
    else if (active) player.current?.play();
    else player.current?.pause();
  }, [active, ready, reducedMotion]);

  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => {
      const height = Math.max(24, ...Array.from(element.children, (row) => Math.ceil(row.getBoundingClientRect().height)));
      setMessageHeight((current) => Math.max(current, height));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [messageIndex, messages]);

  useEffect(() => {
    if (reducedMotion || !active || messages.length < 2) return;
    let timer: ReturnType<typeof setTimeout>;
    const rotate = () => {
      setRolling(true);
      timer = setTimeout(() => {
        setMessageIndex((current) => (current + 1) % messages.length);
        setRolling(false);
        timer = setTimeout(rotate, 2580);
      }, 420);
    };
    timer = setTimeout(rotate, 2580);
    return () => clearTimeout(timer);
  }, [active, messageHeight, messages, reducedMotion]);

  const moving = rolling && active && !reducedMotion;
  const messageAt = (index: number) => (messages[index] ?? "").replace(/[\u2014\u2013]/g, "-");
  return (
    <div className="doodle-stage doodle-stage-loading" role="status" aria-live="polite">
      <div className="loading-animation" aria-hidden="true" data-ready={ready}>
        <Image className="loading-poster" src="/animations/pencil-loader-poster.webp" alt="" width={320} height={280} unoptimized />
        <div ref={container} className="loading-lottie" />
      </div>
      <span className="loading-primary">{copy.loadingPrimary}</span>
      <div className="loading-message-slot" aria-hidden="true" style={{ minHeight: Math.max(58, messageHeight) }}>
        <div className="loading-message-viewport" style={{ height: messageHeight }}>
          <div ref={track} className="loading-message-track" data-index={messageIndex} data-rolling={moving} style={{ transform: `translateY(${moving ? -messageHeight : 0}px)` }}>
            {[messageAt(messageIndex), messageAt((messageIndex + 1) % Math.max(1, messages.length))].map((message, index) => (
              <div className="loading-message" key={index} style={{ minHeight: messageHeight }}>{message}</div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{copy.loadingSr}</span>
    </div>
  );
}
