"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeToMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

const motionAllowed = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !document.hidden;

export function AnimatedPromptHint({ prompts }: { prompts: readonly string[] }) {
  const enabled = useSyncExternalStore(subscribeToMotion, motionAllowed, () => false);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"waiting" | "typing" | "hold" | "deleting">("waiting");
  const prompt = prompts[index];
  const length = Array.from(prompt).length;
  const previousLetter = Array.from(prompt)[count - 1];

  useEffect(() => {
    if (!enabled) return;
    const delay = phase === "hold" ? 2400 : phase === "waiting" ? 550 : phase === "deleting" ? 32 : previousLetter === " " ? 130 : 65;
    const timer = window.setTimeout(() => {
      if (phase === "waiting") setPhase("typing");
      else if (phase === "hold") setPhase("deleting");
      else if (phase === "deleting") {
        if (count > 0) setCount(count - 1);
        else {
          setIndex((current) => (current + 1) % prompts.length);
          setPhase("waiting");
        }
      } else if (count < length) setCount(count + 1);
      else setPhase("hold");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, phase, count, previousLetter, length, prompts.length]);

  if (!enabled) return null;
  return <div className="animated-prompt-hint" data-phase={phase} aria-hidden="true">
    <span>{Array.from(prompt).slice(0, count).join("")}</span><span className="prompt-hint-caret" />
  </div>;
}
