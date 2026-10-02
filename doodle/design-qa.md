# Option 2 landing design QA

final result: passed local responsive presentation review

Source visual truth: `docs/design/landing-option-2.png`, the second displayed generated concept selected by the owner.

Implementation: `http://localhost:9043/`.

Evidence directory: `C:/Users/Sami/.codex/doodle-live-evidence/landing-concepts-oct2/`.

## Comparison

- Desktop CSS viewport: 1440 x 1000. Full page screenshot `implementation-desktop-v3.png`. The browser captures 1425 content pixels because its scrollbar occupies 15 pixels.
- Source pixels: 1024 x 1601. Both source and implementation were normalized to 1024 pixels wide without stretching. Normalized implementation is 1024 x 1688. Additional height retains existing resource and refund links beneath the main footer.
- State: filled birthday prompt, idle, English, anonymous. Remaining quota is actual state after a successful generation, not the mock's fixed free-trial sentence.
- Full comparison: `comparison-desktop.png`. Focused readable controls and typography: `comparison-composer.png`. These combine source and implementation in the same comparison image.
- Mobile: 390 x 844, `implementation-mobile-final.png`. The complete composer and Create action are above the fold. No horizontal overflow. Smaller typography and tighter spacing intentionally adapt the desktop target.

## Required fidelity surfaces

- Fonts: existing local Next font output renders Bricolage Grotesque headings and IBM Plex Sans body and controls. Computed families verified in browser. Actual brand fonts are preserved rather than approximating image-generated letter shapes with generic fonts.
- Spacing: centered two-line headline, wide composer, pill suggestions, centered square example, labelled caption, two-column support and restrained footer match the selected hierarchy. Initial comparison found undersized navigation/control/support text and missing footer wordmark. Both corrected and recaptured in v3.
- Colors: cream web surface, charcoal text, dark green controls and yellow artwork. Focus is visible, disabled state legible, no decorative gradients introduced.
- Images: dedicated 1024px WebP illustration recreated from the selected concept, sharp at the rendered size. Official localized Google Play badge retained. Artwork is a marketing illustration, not a record of a live generation. The reproduced drawing has small raster differences from the concept, recorded as P3.
- Copy: selected English heading, purpose, composer, occasion labels and support text are retained. Localized presentation for all ten supported locales. User balances remain dynamic. Existing SEO, resource, refund and contact destinations remain available.

## Functional and state evidence

- Birthday, lunchbox and journal suggestions fill an editable prompt without generating. Empty input disables Create. Existing initialScene prefills remain supported.
- One real generation completed through the unchanged local backend using the configured generation provider, with fixture mode disabled. Quota went from four to three. `implementation-loading.png` and `implementation-generated-result.png` show loading and genuine output.
- Loading retains the generous yellow card and steady rotating in-card messages. Result displays its own artwork and Download, Share and new-scene actions. Example label disappears for a real result.
- New-scene action returns to the empty composer. Sign-in dialog opens and dismisses correctly. This checkout/auth implementation is unchanged. Actual Google authentication and a payment transaction were not repeated. The copied local environment has a dummy OAuth client value, producing a Google widget configuration error when sign-in was opened. This is a local preview limitation, not a production OAuth change.
- Error retention/retry is covered by the component regression test, not claimed as a browser screenshot check.
- Installed presentation checked at `?runtime=app` in a 390px browser: web hero, artwork and support/footer remain hidden; original create/ideas/settings navigation remains. `implementation-installed.png`. This is a browser runtime check, not a Play-installed native end-to-end test.
- Component checks: 36 passed across DoodleClient, DoodleStage and MobileAppWorkspace. Typecheck and targeted ESLint passed. Browser had no errors before opening Google sign-in; the local dummy-client error described above is the only observed console error.

## Comparison history

1. Initial capture: `implementation-desktop.png`. P2: header and supporting/control typography too small relative to source; footer lacked the reference's wordmark and clear legal row.
2. Intermediate capture: `implementation-desktop-v2.png`. Added footer hierarchy and increased headline. Further focused comparison prompted control/header sizing and cream-surface corrections.
3. Final capture: `implementation-desktop-v3.png`, combined full and focused comparisons above. Earlier P2 findings corrected. No actionable P0/P1/P2 visual findings remain. Mobile captured separately after final changes.

## Follow-up polish

- P3: raster illustration differs slightly in pose/stroke texture from the generated visual target. It retains the same subject, style, placement and size.
- Preview is prepared locally. Production deployment and publishing are separate actions.

## Fresh laptop and phone review, October 2

- New audit captures: `review-laptop-1366.png` at 1366x768 and `review-phone-390.png` at 390x844, both at scroll position zero.
- Phone: Create bottom at 510.94px, fully visible; readable purpose, input and suggestions; no horizontal overflow. Phone viewport presentation accepted.
- Desktop P2: Create bottom at 800px in a 768px-high viewport. Its bottom 32px sits below the initial screen. The large headline and vertical spacing delay the immediate-use flow. Recommend tightening the desktop hero/composer spacing at shorter viewport heights while retaining the selected composition.
- This finding concerns first-screen access, not failed generation. No implementation, backend, payment or publishing changes were made during the review. Actual Safari/macOS and physical phone execution remain outside this browser viewport review.

## Shorter desktop spacing correction, October 2

- Owner authorized the final spacing adjustment. A scoped desktop media query at widths of at least 700px and heights up to 850px reduces header/hero gaps, scales the heading with viewport height and slightly reduces the composer blank area. Brand typography, generous controls and the selected centered hierarchy are retained. Tall-screen and phone rules remain intact.
- Settled previews inspected at 1366x768, 1280x720, 1440x1000 and 390x844. Create bottom coordinates: 651.91px, 626.20px, 810.69px and 510.94px respectively, all within the initial viewport. No horizontal overflow. At 1366x768 the whole composer now ends at 672.91px, leaving comfortable space below it.
- Evidence: `landing-laptop-spacing-fixed.png`, `landing-laptop-720-fixed.png`, `landing-large-desktop-final.png`, `landing-phone-spacing-final.png` in the existing evidence directory. Initial loading capture was replaced with the settled account/balance capture before acceptance.
- Production build and TypeScript passed. This correction changes CSS only; no extra implementation-mirroring tests were added. Earlier functional checks remain separate evidence. Prepared locally, without publishing or production deployment.

## Input and language-menu refinement, October 2

- Owner requested dimmer animated input hints, at least five prompts, flags and a higher dropdown with opening/closing motion.
- Five localized hints cycle through a birthday dog, sleepy moon, lunchbox high-five, frog under a leaf and book hugging a bookmark. The initial opacity-reveal version was rejected by the owner and replaced with actual character-by-character typing and backspacing. Each prompt starts empty, types at 65ms per character with short word pauses, holds 2.4 seconds, then deletes at 32ms per character. A 550ms empty pause separates prompts. The caret follows the visible text and blinks during pauses. There is no phrase fade or hidden complete phrase in the animated DOM. The input value remains empty and Create stays disabled until the visitor enters their own text.
- Hint animation disappears on input focus, preserves all drafts, pauses in hidden tabs and falls back to the static native placeholder for reduced motion. Decorative letters are hidden from accessibility announcements.
- Language menu uses local SVG images, independent of emoji/font support. Language names remain explicit and links retain original locale destinations. Menu lifted 6px, restrained shadow, 220ms opening and 160ms closing fade/slide. Escape returns focus to the trigger; outside pointer and focus departure dismiss the menu. Reduced-motion styling removes spatial motion.
- Browser verification on the rebuilt real UI: desktop and 390x844 viewport inspected; all ten flags decoded; no horizontal overflow; typed draft retained and hint removed; focus departure closed the menu; readable language link names and Dutch destination verified. Saved `landing-flags-desktop.png` and `landing-flags-mobile.png` in the existing landing QA evidence directory. Safari/macOS and physical phone browsers were not directly run in this Windows session.
- Production build, TypeScript, targeted ESLint and 45 component checks passed. Existing page tests updated for the option 2 heading levels, disclosed supporting content and repeated header/footer wordmarks. No backend, authentication or billing changes in this refinement. Local preview only.
- Typing correction verified separately: 38 targeted composer/client checks and rebuilt production bundle passed. New regression observes text starting empty, growing one character at a time, reaching the full prompt, then shrinking one character at a time back to empty. Browser captured actual `typing` text `A` and `deleting` text `A sleepy moon tucked under a clo`, with the real textarea still empty. Desktop and 390px layouts inspected, no horizontal overflow. Evidence: `placeholder-typing.png`, `placeholder-backspacing.png`, `placeholder-phone.png` in the existing QA evidence directory.
- Reusable motion rule: when the owner asks for typing and untyping, animate the actual visible text and inspect both directions. An opacity reveal/fade is a different effect and does not satisfy that request.
