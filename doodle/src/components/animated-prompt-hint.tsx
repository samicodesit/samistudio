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
  const [count, setCount] = useState(() => Array.from(prompts[0]).length);
  const [phase, setPhase] = useState<"typing" | "hold" | "fading">("hold");
  const prompt = prompts[index];
  const length = Array.from(prompt).length;
  const previousLetter = Array.from(prompt)[count - 1];

  useEffect(() => {
    if (!enabled) return;
    const delay = phase === "hold" ? 2800 : phase === "fading" ? 700 : previousLetter === " " ? 110 : 55;
    const timer = window.setTimeout(() => {
      if (phase === "hold") setPhase("fading");
      else if (phase === "fading") {
        setIndex((current) => (current + 1) % prompts.length);
        setCount(0);
        setPhase("typing");
      } else if (count < length) setCount(count + 1);
      else setPhase("hold");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, phase, count, previousLetter, length, prompts.length]);

  if (!enabled) return null;
  let position = 0;
  return <div className="animated-prompt-hint" data-phase={phase} aria-hidden="true">
    {prompt.split(/(\s+)/).map((word, wordIndex) => <span key={`${index}-${wordIndex}`} className={word.trim() ? "prompt-hint-word" : undefined}>
      {Array.from(word).map((letter, letterIndex) => <span key={letterIndex} data-visible={position++ < count}>{letter}</span>)}
    </span>)}
  </div>;
}
