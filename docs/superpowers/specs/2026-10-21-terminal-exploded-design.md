# Terminal exploded view

Historical separate-screen design. The current implementation follows `../plans/2026-10-21-terminal-in-place-revision.md` and preserves the homepage in place.

## Intent and acceptance

Build a hidden, polished, interactive teardown of the existing Sami Studio terminal. Preserve its cream rounded enclosure, recessed black display, three oversized keys and amber pilot. Parts must have credible mounting, clearances and assembly order. Retain construction source, export tooling and reusable model assets. Execute inline as requested; do not publish or deploy.

## Chosen design

A registered photographic assembly preserves the actual exterior at source-pixel level. Its cream casing, black bezel and three purple/amber caps come directly from the existing artwork. Added internals are a plausible interpretation, with switches registered beneath the actual key faces and a flat display carrier connected by a ribbon. The procedural 3D study did not match the exterior closely enough and remains a construction helper outside the runtime.

The hidden entry is the amber pilot: hold for 700 ms, or activate with keyboard. The playground also accepts `explode`. A full viewport modal opens the assembled terminal, then separates rear shell, logic board, display module, front housing, and keycaps along a shared illustration axis. Portrait phones arrange that axis vertically. A continuous slider reverses or scrubs the assembly. Selecting a part frames it for inspection and supplies a functional description. Drag pans the inspected part; Show all parts restores the complete assembly. Escape or Back to terminal restores the prior screen and focus.

## Visual direction

The object is the focal point. Preserve the actual exterior palette and baked studio illumination. Use a rose backdrop, restrained dark controls, the site's DM Serif Display title and Inter text. Sparse perimeter controls, soft separation shadows, mounting guides, moulded ribs, brass inserts, display ribbon, PCB traces, chips and three distinct key legends. No decorative looping motion.

## Structure and lifecycle

`assets/terminal-exploded.mjs` owns entry, modal, focus and lazy loading. `assets/terminal-assembly.mjs` owns functional part metadata. `assets/terminal-construction.mjs` owns source registration, projection and editable interior construction. `assets/terminal-renderer.mjs` owns composition, shadows, inspection, demand rendering and disposal. The actual live display and key legends are cloned without duplicate IDs or interactive focus. A foreground canvas preserves occlusion over screen content. Shared preference controls reduced motion. Code and construction load only on entry. Close removes overlays, listeners and animation frames. Asset failure leaves a usable close action and retry.

## Constraints

- Keep current workspace changes. Work in place because the current terminal is uncommitted here.
- No remote runtime requests. Three.js and its MIT license remain with the retained 3D study only.
- No publishing, deployment, payments, credential changes or unrelated edits.
- Reduced motion sets separation immediately and disables automated camera movement.
- Model fits phone portrait, phone landscape, tablet and desktop without covering controls.
- Modal traps keyboard focus through native dialog semantics. Controls have visible focus and at least 44px touch targets.
- Retain construction source, lossless PNG layer exports, source-pixel comparison, dependency manifest, regeneration scripts, plans, the earlier mesh study and final QA evidence.

## Verification

Unit tests cover clamped and reversible separation, consistent axes, switch/key registration and part metadata. The export helper compares opaque exterior interiors against source image pixels, excluding the antialiased glass boundary. Browser checks cover entry cancellation, pointer and keyboard entry, lazy loading, REPL command, focus containment and restoration, Escape, repeat opens, stale native close events, delayed loading, failure/retry, viewport resize, reduced motion and existing galleries. Run the entire homepage suite and explicit packaging build. Inspect rendered screenshots at desktop and phone sizes. Physical mobile devices and cross-client image delivery require separate user confirmation.
