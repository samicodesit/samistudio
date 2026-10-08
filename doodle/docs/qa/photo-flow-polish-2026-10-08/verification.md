# Photo flow polish verification

October 8, 2026. Follow-up to the [photo flow audit](../photo-flow-audit-2026-10-08/audit.md), on `codex/photo-input`, starting at `f3d6db5`.

## Implemented

- Photo failures use concise localized recovery copy for invalid images (400), oversized requests (413) and refusals (422). Temporary failures, timeouts, rate limits and standard text-scene guidance keep their existing messages. Website and Android share the photo copy. Native error codes are accepted with their corresponding HTTP status, preserving existing fallback behavior for unrelated failures.
- A successful photo replacement clears the old generation error. Cancellation and damaged replacements preserve the usable photo and generation error. Remove clears generation and preparation errors, restores the saved writing draft and focuses the textarea. Native Remove now clears the old generation failure too.
- Website results have one quiet arrow and Back label above the drawing, localized in all ten languages with a reversed Arabic arrow. Back restores the same photo, writing draft and detail level, preserves the displayed allowance, focuses Create for photos or the textarea for text, and releases the old result object URL. It sends no request. Download, share and secondary result actions keep their grouping. Android's existing arrow now has the correct Back accessibility label.
- The installed web layout uses the existing compact result sizing on screens at most 700px high. At 320 x 568 the result actions fit above bottom navigation. Loading animation size and messages were not changed.

## Evidence

New website regressions first reproduced six failures for photo-specific messages, stale errors and missing Back. Native API regressions first reproduced three lost error codes. All now pass. The existing native diagnostics test also caught an over-broad error mapping during implementation; matching codes to status fixed it without changing the test.

- Full web suite: **685 passed, 1 paid-provider test skipped**. No real provider tests enabled.
- Full native suite: **115 passed**. The first run alongside the full web suite and lint hit the existing 10ms real-timer request-budget test; the complete native suite passed when rerun without that load. No timeout logic or timeout test was changed.
- Web and native TypeScript passed. Full web lint passed with three existing warnings in unrelated marketing/card files; targeted lint for changed TypeScript files passed without warnings.
- Production website build passed, including TypeScript and 84 generated pages. This is a build check, not a deployment.
- **12 browser checks passed**, covering result Back in ordinary and installed web layouts plus refusal/replacement/Remove on WebKit iPhone SE, iPhone 13, iPhone 13 Pro Max and Chromium Pixel 5 profiles. The four installed-layout tests were extended and rerun after the compact sizing change; all four passed at 320 x 568 and verified actions above the bottom navigation with no horizontal overflow.
- CUA visual inspection: desktop website at 1280 x 900; installed web English and Arabic at 375 x 812; compact Arabic at 320 x 568. Arabic arrow and layout direction, restored focus, detail and usage were inspected. IBM Plex Sans, Bricolage Grotesque and Alexandria were loaded in the inspected screens.
- All four protected standard-generation hashes match their baseline. Photo prompt, photo provider request, preparation limits/quality and billing logic were also unchanged in the diff.

The actual local interface and local photo preparation were exercised. A loopback proxy simulated or blocked every API route, with a dummy provider key on the upstream server. Successful results returned the existing public two-dog drawing from the previous paid experiment, regardless of selected detail. These captures are not new conversion-quality evidence. Seven fixture requests were made across the visual sessions. Back did not increment those request counts. Provider spend: **$0**. Both temporary servers were stopped.

Native Android controller changes were reviewed in source, tested through the shared copy and native API regressions, and typechecked. No fresh Android installation or physical-device run was performed. WebKit profiles are browser emulation, not a native iOS app or real iPhone certification. Play-installed end-to-end tests, final Data safety review and independent release review remain release gates. Nothing was deployed or published.

## Current screenshot manifest

These are current QA captures, not approved marketing assets. All show the real local UI with simulated backend responses. Partial, transient and blank captures were rejected and overwritten with inspected captures. The desktop result uses a full-page capture; phone captures show their app context. The Next.js development indicator is visible in some captures and is not part of the production UI.

1. [Photo-specific refusal](01-photo-refusal.jpg), website phone.
2. [Successful replacement clears the error](02-replacement-clean.jpg), website phone.
3. [Desktop Back placement](03-desktop-result.jpg), website full page.
4. [Phone result with Back](04-phone-result.jpg), installed web layout, 375 x 812. Selected for owner delivery.
5. [Back restores photo and Medium](05-phone-back-to-photo.jpg), installed web layout.
6. [Remove restores the writing draft](06-writing-restored.jpg), installed web layout.
7. [Arabic result](07-arabic-result.jpg), installed web layout, 375 x 812.
8. [Compact Arabic result](08-compact-arabic-result.jpg), 320 x 568. Secondary actions bottom 456px, navigation top 495px, no horizontal overflow.

The delivery copy of capture 4 is `C:/Users/Sami/.codex/visualizations/2026/10/08/01a11bde-c3e0-7921-859c-d17d8c0cc4fe/photo-flow-back-final.jpg`. It has identical provenance and QA status. It is retained as a final deliverable for desktop display; image bytes are also delivered for mobile.
