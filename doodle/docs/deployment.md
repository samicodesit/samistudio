# Backend deployment

## Checkout spacing refinement, 12 October 2026

Current production is dpl_HRiVJQo7iGzZeJfH56NepgdX4gav (READY) at https://doodle.samistudio.nl. The owner requested a tighter gap between Apple Pay and the green purchase button. Only web-pack-purchase-dialog.css changed from the previous production: ready wallets no longer add the scroll area's 18px bottom padding. All 431 uploaded hashes match the candidate. Independent review, all-language desktop/mobile/large-text checks and the fresh Vercel production build/TypeScript passed. Actual authenticated desktop and phone rendering was inspected without payment.

Current release source remains /home/mests/.codex/doodle-adaptive-pricing-release-20261012, now matching this refinement. [Spacing QA](qa/checkout-spacing-2026-10-12/report.md) records final rendering, exact source verification and limits.


## Automatic web currency pricing, 12 October 2026

Owner-approved deployment dpl_J7gHXz34sxWNGL6ygQ5VZtaahRZV is READY at https://doodle.samistudio.nl. New web packs use Stripe Adaptive Pricing: supported local currency is selected automatically, EUR is optional, and the exact provider total appears before payment. No currency paragraph or extra screen was added. Native Play billing and legacy checkout are preserved.

Current web release source: /home/mests/.codex/doodle-adaptive-pricing-release-20261012. It preserves all source from the actual preceding production dpl_775EJytZn6U131HMnnQtKEz3nJAk except the eight scoped payment/UI source and test changes, and omits the obsolete TypeScript build-info upload. All 431 uploaded hashes match the candidate. Unrelated canonical edits remain excluded.

Independent review completed. The existing hosted-only custom_text parameter was removed from Elements sessions, and actual live validation corrected an invalid wallet layout combination to overflow auto with one row and column. Fresh wallet tests, lint, TypeScript and Vercel production build passed. Actual authenticated hosted checkout and cancellation, visible wallet initialization, exact total, desktop/mobile controls and loaded brand fonts were checked without payment. Owner balance remained 95 doodles. Physical Apple Pay payment and a real-money completion/webhook cycle remain untested. Actual Sandbox USD, GBP and JPY payments, credit replay and refunds are recorded separately.

Evidence: [Adaptive Pricing QA](qa/adaptive-pricing-2026-10-12/report.md), [independent review](qa/adaptive-pricing-2026-10-12/independent-review.md), [published source](qa/adaptive-pricing-2026-10-12/release-published-source.json). Use this release source for later web deployments rather than uploading the dirty canonical checkout.


## Packs and photo backend deployed, 10 October 2026

Owner-approved production deployment `dpl_CK4UMgR53EJ21iW8JEmgmjgAbQdf` is READY at https://doodle.samistudio.nl. Both rollout flags were initially false. After activating all Play products and publishing code 10 internally, validation deployment dpl_7AYM5cWFFptKznpBRQYPAzySTZBW enabled PLAY_PACKS_CHECKOUT_ENABLED; STRIPE_PACKS_CHECKOUT_ENABLED remains false. This is the current READY deployment. Its 427 uploaded source files also match the candidate. Existing ten-credit checkout and purchase recovery remain supported. All 427 uploaded source file hashes match the reviewed candidate in `C:/Users/Sami/.codex/worktrees/android-doodle-packs/samistudio/doodle`, including the previously published footer and Ideas gallery. The actual Vercel Turbopack build and TypeScript passed after fixing a route configuration re-export. Website and public catalog HTTP checks passed; the daily Play refund reconciliation cron remains configured. Evidence: [deployment](qa/combined-release-2026-10-10/backend-deployment.json), [published source](qa/combined-release-2026-10-10/backend-published-source.json), [live health](qa/combined-release-2026-10-10/backend-live-health.json).

Web and mobile web contain the same three packs and shared launch offer, pending Stripe setup and real test-mode payment validation before enabling them. All three Play products are active and code 10 is available internally. Play-installed Android purchase validation remains in progress. The owner also approved conditional public Android submission after passing those tests, plus launch and reporting verification. This backend deployment is not evidence of an Android public launch. See [testing and release record](qa/combined-release-2026-10-10/testing-setup.md) and [Stripe setup](qa/web-packs-2026-10-10/stripe-setup.md).

The dated delivery entries below are historical. Their production IDs and source paths describe those deliveries, not the current production source.

From the Doodle project directory in Ubuntu/WSL, use the standard Vercel command:

```sh
npx vercel --prod
```

The project is already linked to Doodle in `.vercel/project.json`. This publishes the web backend and website. A backend-only update does not require an Android build or Google Play submission.

Use the intended release source in the checkout. The command uploads the current checkout; it does not distinguish unfinished local work from approved release changes. Obtain the owner's deployment approval under AGENTS.md, then run the command. Do not invent a separate prompt-specific deployment command or repeat completed QA.

On 30 September 2026, the vague-subject update was deployed as `dpl_2oNzhiU8HDfcVDUvEva6LjAmC9gd`. Vercel returned READY with aliases assigned. The release retained the previous production source, changing only the generation prompt and its obsolete no-text test assertion.

On 1 October 2026, production was `dpl_G6kXgdejq8wtZFhVSoyS5BF4upMm`, published from `13ea356`. It raises the server-owned free trial to four successful doodles and keeps older Android guest startup compatible. Previously used trial counts and paid credits are preserved. The earlier usage metrics remain available with `npm run metrics`; see `docs/usage-metrics.md`. Main matches all 228 uploaded source hashes; see `docs/production-baseline.json`.

Build 7 (0.1.5) and its matching four-free English store description were submitted through Play Console on 1 October 2026. Publishing overview shows Changes in review while quick checks run. The approved release will publish automatically at 100% rollout because managed publishing is off. Public Android remains build 6 until approval. Its canonical source is aacd2ce on codex/doodle-next-update at C:/Users/Sami/.codex/worktrees/doodle-next-update/samistudio/doodle. The final bundle is /home/mests/projects/samistudio/doodle/mobile/artifacts/doodle-release-v7.aab. Deploy web releases from main, rather than the native checkout.

## Landing release, October 2, 2026

Current production is dpl_2YjycmSA5qf6nvptiDbSysvfXXf2, source commit 439c00a, live at https://doodle.samistudio.nl. The approved option 2 landing includes localized copy, typed and backspaced hints, SVG language flags and the final laptop and label spacing. Main was fast-forwarded to that source. Unrelated local changes were preserved and excluded by deploying the clean landing worktree with the same standard Vercel command and production project link.

Vercel returned READY and assigned the public alias. All 46 targeted component checks passed; Vercel production build and TypeScript passed. The published page was visually inspected at actual CSS sizes 1366x768 and 390x844, with no horizontal overflow. All ten SVG flags loaded when the menu opened, four free doodles was shown, and the Google Play destination was confirmed. Evidence: landing-live-desktop.png and landing-live-phone.png in the existing landing evidence directory. Generation, authentication, payment and native APIs are unchanged; live transactions and physical-phone checks were not repeated.

## Grid overlay and paper prompt, October 3, 2026

Production is `dpl_CLcGaESwXfbF3hMzDpsyNn6rfnib`, READY at https://doodle.samistudio.nl. The result has an icon-only 4x4 grid toggle with a 180ms fade and a reduced-motion alternative. Enlarging preserves the grid; download and share retain the original image. No blank practice grid was added.

The previously pending paper-color prompt is now deployed with `#FFEB8A`. One owner-approved real API sample was generated and visually inspected before publication. The uploaded prompt and profile hashes match the checked source. This backend prompt also serves Android immediately. Android's grid UI is implemented in the canonical native checkout and verified in an isolated fixture package, but no Android release or store submission was made.

Release source: `/home/mests/.codex/doodle-grid-release`. It was reconstructed from all 250 source hashes of the actual preceding deployment, `dpl_FTEdyj515RhPm8MfRrMxonazLDyV`, then changed only for the grid and paper prompt. Other pending main and native changes were preserved. Future web deployment must use the intended production source rather than uploading the dirty main checkout indiscriminately.

Evidence and verification limits: `docs/qa/grid-copy-2026-10-03/verification.json`. Three grid browser cases passed locally and again against the deployed website at 1280, 390 and 320 CSS pixels. The deployed UI was visually inspected with a saved real image and mocked account/generation responses. This is separate from the real prompt sample and native fixture rendering. Existing full-browser checks include four obsolete landing-layout assertions, recorded by name; no independent reviewer or Play-installed end-to-end validation was used.

## Shared doodle previews, October 3, 2026

Production is `dpl_CSnNeGgPn2YheGQAbev9UmQD3NC8`, READY at https://doodle.samistudio.nl. Results, landing examples, public Ideas and installed web Ideas now use one `DoodlePreviewDialog` and one `DoodleGridFrame`. The duplicate Ideas dialog and its CSS were removed. All grids start off; enlarging an existing result preserves its current choice. Examples and Ideas reset when reopened. The same icon-only control, 180ms fade, localized accessible labels and reduced-motion behavior apply throughout.

The release uses the existing isolated production source at `/home/mests/.codex/doodle-grid-release`. The deployed yellow-paper prompt is retained. Unrelated pending source and image changes remain excluded. No additional paid image generation was run.

The web unit suite passed 518 checks with one real-image integration test skipped. Final affected checks passed 39 tests, TypeScript and lint; local and Vercel builds passed. Seven focused browser cases passed locally and against production, including desktop, narrow phones, Arabic, state sharing, attribution, original download URLs and installed Ideas selection. Published screenshots were visually inspected. Live measurement confirms a 0.18s fade and IBM Plex Sans on the action label. Evidence: `docs/qa/grid-preview-consistency-2026-10-03/verification.json`. The earlier four obsolete full-browser assertions remain documented in the first grid delivery record.

Android uses shared `NativeDoodleGridFrame` and `NativeImageModal` components for results, examples and Ideas. Canonical native TypeScript and 94 tests passed. The final fixture build was installed and inspected on the emulator, with Ideas selection, grid default state and result preview state sharing verified. Fixture account, generation and billing flows are simulated. No version bump, Play upload, Android release, independent reviewer or physical-phone end-to-end check was performed.

The owner's subsequent yellow-paper consistency request was deployed as `dpl_2BBieLNp6t4o3rF7paT9Y41hFpgw`, now READY at the same public URL. It applies `#FFEB8A` to the web paper token and publishes the existing corrected eight Ideas assets and reference image. All nine match the prepared native assets and the existing palette manifest. The published originals' SHA-256 hashes were verified directly, and the live CSS token was checked. The local/Vercel builds and all seven focused local/live browser cases passed again after the palette update. Updated published screenshots and asset provenance are in the same delivery record. The backend prompt was already live and remains unchanged.


## Grid contrast release, October 8, 2026

Owner-approved 1.5px dashed blue grid with a pale halo is live at https://doodle.samistudio.nl, deployment `dpl_9cffgd4pBF8SkEnDFWPLghmf8o5t` (READY). The release uses the actual current baseline `dpl_DsbUcyzwnbfipTydVLkytqfw79ro`, changing `src/components/grid-overlay.css` and `src/lib/grid-copy.ts`. Next.js also automatically rewrote the type imports in `next-env.d.ts` for the local preview; this generated declaration has no runtime effect. All 289 uploaded source hashes were verified with no other differences. Current release source: `/home/mests/.codex/doodle-grid-contrast-release-20261008`. Use that source for subsequent releases, rather than either older release folder or the dirty main checkout.

Seven focused release checks and the Vercel production build/TypeScript passed. Published grid rendering was inspected on desktop and a 390px phone viewport, including dense artwork, alignment, original image link and existing fade. No native Android release or paid generation. Evidence and exact patch: `docs/qa/grid-contrast-2026-10-08/`.

## Mobile Google Play badge, October 9, 2026

Owner-approved 128px official localized Google Play badge is live below the full mobile Or try one section, with no caption. Mobile gaps and composer height were reduced by 24px total. Desktop and installed app presentation are retained. Production deployment dpl_HBJiqqRZLB6ABLCEWMmmJU4LJrSH is READY at https://doodle.samistudio.nl, source commit 9e275f0 on codex/mobile-play-badge.

Current web release source: /home/mests/.codex/doodle-play-badge-20261009. It preserves all 291 uploaded files from dpl_ECHPR6fCvWvSAGNmRx7xvAZtSZJV except the two approved UI changes. All 291 final uploaded hashes match the candidate. Use this source for subsequent web releases rather than uploading the dirty main checkout or an older release folder.

All 53 targeted component checks, TypeScript, changed TSX lint, local production build and Vercel build passed. Published rendering was inspected at 390x700 and 1280x900. The badge tap target ends at 628px in the 390px layout and 639.44px at 360x640, with no overflow and the canonical Play package destination. Small screens and wrapped suggestions may still require scrolling. Live account showed four free doodles; generation, authentication, payment and native end-to-end checks were not repeated. Evidence: docs/qa/mobile-play-badge-2026-10-09/verification.json.



## Web localization follow-up, 10 October 2026

Owner-approved deployment dpl_775EJytZn6U131HMnnQtKEz3nJAk is READY at https://doodle.samistudio.nl. Narrow headings, Arabic pack grammar, shared-limit wording and a type-only form declaration fix are live. Brand fonts, dependencies, prompts and billing rules are unchanged. All 432 uploaded source hashes match the candidate. Forty focused tests, TypeScript, lint, local/Vercel production builds, twelve local browser cases and three live cases passed. Actual desktop/RTL/mobile rendering was inspected separately. Initial gzip-compressed JavaScript increased by 96 bytes, about 0.03%. No Android release or paid generation. Native changes remain queued.

Current web release source: /home/mests/.codex/doodle-localization-release-20261010. Preserve this baseline rather than uploading the dirty native checkout. Evidence: [localization web release](qa/localization-2026-10-10/web-release.md).

## Checkout scrolling, 12 October 2026

Owner-approved checkout refinement is live at https://doodle.samistudio.nl, deployment dpl_BEqzs5ctJmowTDSBin6jKbJZjsqV (READY). Background scrolling is locked during purchase, desktop width stays stable, phones fill the viewport, and 4px surrounding wallet padding removes the unnecessary tall-desktop scrollbar. Small screens and larger text retain inner scrolling with visible purchase/dismissal actions. No extra copy or payment behavior changes.

Four browser cases, 21 component tests, TypeScript, focused lint and the fresh Vercel build passed. The independent reviewer approved the bounded changes. Actual production desktop and phone wallet rendering, scroll containment and close restoration were inspected without payment. All 431 uploaded hashes match the isolated release, changing only src/components/web-pack-purchase-dialog.css from the previous spacing deployment. Current clean source: /home/mests/.codex/doodle-adaptive-pricing-release-20261012. Evidence: [checkout scroll verification](qa/checkout-scroll-2026-10-12/report.md).
