# Detail selector design QA

Source visual truth: docs/design/detail-selector-2026-10-21/combined.html and combined-review.png.

Normalized source capture: docs/qa/detail-selector-2026-10-21/reference-open.png.
Implementation capture: docs/qa/detail-selector-2026-10-21/web-production-open.png.
Both captures are 390x844 pixels at a 390x844 CSS viewport, selected Medium, picker open. The screenshot API normalizes source/device density to CSS pixels. Both images were inspected together. Focused comparison used the compact trigger and the entire picker, where copy, type, borders and examples are readable. The default change to Medium is intentional.

## Findings and fixes

1. Desktop landing initially clipped the new trigger because its existing heading was visually hidden. The trigger is now visible while the redundant desktop heading/hint remain accessible to assistive technology. Desktop and all translation checks passed after this fix.
2. Android initially wrapped Medium inside the compact trigger. Responsive native width now preserves a single-line English level at regular sizes. Final regular and small screenshots were inspected.
3. Largest iOS accessibility text split the drawer heading awkwardly. Detail title scaling is capped at 200%; body/options continue to use the platform preference, and the shared drawer scrolls. SE 3 accessibility interaction tests passed after the fix.

## Fidelity surfaces

Fonts: existing Bricolage Grotesque headings, IBM Plex Sans body and Alexandria Arabic retained. Actual loaded web family names and rendered native screens inspected. No rotated/scaled readable controls.
Spacing: source and web picker align at the same viewport; composer dimensions are preserved. Native uses existing safe-area drawer spacing and a slightly wider trigger to avoid wrapping.
Colors: existing paper/moss/graphite tokens retained, with the shared native scrim and a matching restrained web scrim. Selection border and check clearly identify Medium.
Images: actual approved dog-and-balloon thumbnails at all three levels, unchanged crops and hashes. No generated replacement or placeholder artwork.
Copy: explicit Detail and selected level; short explanations shared across native and web in all supported languages.

## Interaction and responsive checks

Opening, selection, persistence, close transitions, keyboard radio navigation, Escape and focus return verified through unit tests and the production browser. Actual mobile, desktop, RTL, native regular, small and large-text layouts inspected. Production browser console had no errors. Native provider and store release checks are outside this fixture UI verification.

No actionable P0/P1/P2 findings remain. Independent-agent review was not used under the user's inline-only routing policy.

final result: passed
