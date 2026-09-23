# Loading flow polish — 7 September 2026

Post-deployment verification passed against the production alias using normal pointer input at all three viewports. Loading, rotated message and result remained visible with scrollY 0 throughout; root also inspected the production mobile rendering. Generation was intercepted for these UI checks.

User intent: retain the original large yellow note animation and rotating messages as a pleasant waiting experience. Remove only the repeated heading, eyebrow, prompt quote and explanatory text outside the card. Keep the animation proportionate.

Final changes preserve DoodleStage's original animation, timers and accessible timing text. Phone loading cards are capped at 300px (280px on a 320px viewport); the rotating-message area reserves space to prevent layout shifts. Desktop uses the same visual column for loading and result. No experimental scroll workaround remains.

Independent QA approved normal-motion rendering at 320×640, 360×640 and 1440×900, observing the initial animation, 1.8 seconds, the message change at 8.3 seconds and the result. Cards stayed visible, scrollY stayed 0, and desktop loading/result bounds matched. Mobile retained its top anchor with a modest size reduction on completion. The review found the motion calm and proportionate. An apparent desktop scroll failure was isolated to Playwright locator auto-scrolling before pointerdown; actual pointer clicks did not reproduce it.

The implementation agent ran 25 relevant tests, typecheck and lint. Root reviewed the final diff and desktop/mobile screenshots. Production build passed and deployment `3jLAzwcT48edCo7vTaEaAsKXxU26` was aliased to doodle.samistudio.nl. Reusable normal-motion verification: `test-results/loading-motion-qa.mjs` with `QA_BASE_URL`; account and generation responses are fixtures, so this verifies UI behavior without spending credits or claiming backend generation evidence.

The 12-second editorial demo was refreshed to the same 300px loading card. The loading still is a documented local deferred-request capture; existing real prompt/result/detail captures remain unchanged. Final MP4 SHA256: `aecf2c9f1b2c224c3cb4ca9eb3165eb6c37aefec1fe53a148803da066f49aa30`. Demo captions are outside the app UI. No new social post was published during this refinement.
