# Terminal Exploded View Implementation Plan

This historical modal plan is superseded by `2026-10-21-terminal-in-place-revision.md` after the user's stricter in-place and full-scene fidelity requirements.

> Execute inline using superpowers:executing-plans. The user requested planning and execution. Retain construction assets and helpers.

**Goal:** A credible interactive exploded view of the same homepage terminal.
**Architecture:** Lazy modal controller, source-registered photographic layers, editable interior construction, demand-driven Canvas rendering and live display overlays. The earlier procedural model remains a helper.
**Tech Stack:** Native modules, Canvas 2D, CSS, Node tests, Playwright QA. Pinned Three.js 0.186.1 is retained outside production for the mesh study.
**Spec:** `docs/superpowers/specs/2026-10-21-terminal-exploded-design.md`

## Global constraints

Preserve existing uncommitted work. No deployment. No em dash in authored text. Keep all reusable construction assets. Share motion preference. Local runtime dependencies only. No delegated agents.

## Review focus

1. Rapid close during lazy loading must not start a hidden renderer.
2. Context loss or dependency failure must leave working dismissal and retry.
3. Opening from the REPL must restore its history and screen without reopening a keyboard.
4. Portrait and landscape must keep model and controls separated.
5. Repeated opening must not accumulate GPU resources, listeners or render loops.

### Task 1: Assembly contract and construction

**Files:** `assets/terminal-assembly.mjs`, `assets/terminal-construction.mjs`, `design-assets/terminal-exploded/`, `tests/terminal-exploded.test.mjs`, `tests/terminal-construction.test.mjs`.
**Interfaces:** `terminalParts`, `layerPose(id, progress, axis)`, front-plane/inverse projection and `makeConstructionLayers({housing,keycaps})`.

- [x] Write and run failing tests for bounds, reversibility, axes, original artwork registration, switch positions and metadata.
- [x] Implement photographic exterior masks, actual keycap sources, shared projection and credible editable interiors.
- [x] Retain the initial mesh, pinned Three.js helper bundle, construction manifest and license outside production.
- [x] Run assembly tests. Export reusable lossless registered layers and verify exterior source pixels.

### Task 2: Experience and integration

**Files:** `assets/terminal-exploded.mjs`, `assets/terminal-renderer.mjs`, `assets/terminal-exploded.css`, `index.html`, `assets/studio.js`, `assets/secret-terminal.mjs`, build allowlist and tests.
**Interfaces:** `initExplodedTerminal({trigger,isAvailable,onEnter})` returns `{open,close,destroy}`; async `createTerminalRenderer({canvas,reducedMotion,onSelect})` returns lifecycle, separation and inspection controls.

- [x] Write failing tests for `explode` parsing and verify lazy runtime packaging.
- [x] Implement pilot hold and keyboard activation, lazy modal, loading/failure/retry, focus return, selection, slider and reassembly.
- [x] Build source-faithful renderer with shadows, live screen occlusion, responsive framing, inspection, reduced motion and disposal.
- [x] Integrate REPL entry, asset allowlist and CI syntax checks. Run targeted tests.

### Task 3: Acceptance and reusable deliverables

**Files:** `scripts/qa-terminal-exploded.mjs`, `scripts/qa-terminal-lifecycle.mjs`, `scripts/export-terminal-assets.mjs`, construction README, QA evidence.

- [x] Browser checks: desktop and phone sizes, keyboard and pointer hold, cancel hold, Escape, repeated opening, REPL, resize, reduced motion, delayed loading, failure/retry and existing gallery.
- [x] Inspect screenshots, refine registration, joins, switch positions, phone composition and inspection.
- [x] Run full homepage tests and build. Verify local requests and no renderer errors.
- [x] Self-review inline according to user routing policy. Record evidence and retain reusable sources, helpers and final evidence.
