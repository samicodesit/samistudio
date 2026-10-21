"use client";

import type { MouseEvent, ReactNode } from "react";

export function CreatorLink({ children }: { children: ReactNode }) {
  function returnToCreator(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById("doodle-tool");
    if (!target) return;
    event.preventDefault();
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = "doodle-tool";
    if (window.location.hash !== nextUrl.hash) window.history.pushState(window.history.state, "", nextUrl);
    target.scrollIntoView({ block: "start", behavior: "instant" });
    const input = target.querySelector<HTMLTextAreaElement>("#scene:not([disabled])");
    (input ?? target).focus({ preventScroll: true });
  }

  return <a className="primary-action landing-create-link" href="#doodle-tool" onClick={returnToCreator}>{children}</a>;
}
