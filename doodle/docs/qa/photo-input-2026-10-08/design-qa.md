# Photo input verification, October 8, 2026

Status: local implementation, not deployed. Inline code and visual review only. Independent release review and Play-installed end-to-end verification remain required before release.

## Behavior and presentation

Photo input uses the existing composer. Use a photo and Change photo share the same footer position and photo icon. Create doodle stays in the opposing footer position. Remove is attached to the preview and restores the text draft and focus. Photo selection is local. Picker cancellation preserves the selected photo. Suggestions disappear while a photo is selected. Existing results, grid and waiting card are reused.

Inspected the actual web app at 320x740, 390x844 and 1280x900, plus Arabic RTL at 390x844. The final footer arrangement was checked in Arabic after the adjustment. Computed typefaces were Bricolage Grotesque for headings, IBM Plex Sans for English controls and Alexandria for Arabic controls. At 320px the heading wraps; photo and controls remain readable without clipping. Local web account configuration was deliberately absent, so this was real UI verification with account fallback, not a live web purchase or generation test.

Android API 36 on a separate QA emulator: actual system picker, local decoding, replacement, cancellation and Remove restoring ?A little coffee cup? with input focus. The fixture APK was rebuilt with the explicit fixture flag. Verified simulated photo submission through the existing waiting and result states, with one fixture credit consumed. These results do not establish real Play Integrity, billing or provider behavior. Inspected the initial text composer at font scale 1.4; selected-photo state at that scale remains unverified because Android recreated the Activity. Normal-scale selected-photo screenshot is from the real native picker.

The APK manifest has no CAMERA, RECORD_AUDIO, READ_MEDIA_IMAGES or READ_MEDIA_VISUAL_USER_SELECTED. Legacy read/write storage permissions remain limited to Android API 32 and below. Fixture package and explicit flag are both required; production package fails the fixture gate.

## Checks

- Web suite: 97 files passed, 648 tests passed, 1 optional paid test skipped.
- Native suite: 17 files, 105 tests passed.
- Web and native TypeScript checks passed.
- ESLint passed with three pre-existing warnings in unrelated files.
- Default Turbopack production build passed, 84 pages. Worktree dependencies are now installed locally instead of linked outside the build root.
- Android fixture build passed. Source-only focus-border polish was compiled in the final fixture build.
- Git diff whitespace check passed. Unchanged lines preserve baseline formatting.
- Standard prompt, text generator, generation profile and paper correction are unchanged against fcd03f7. SHA-256 values are in standard-generation-hashes.json.

## Actual Flare verification

Production photo conversion function, gpt-image-2.5-flare, MEDIUM, 1024 square, all three detail levels, one public two-dog input. No provider retries. Provider response times: Simple 21.243 seconds, Medium 11.680 seconds, Detailed 11.889 seconds. Estimated costs from returned usage: $0.023677, $0.022612, $0.022782. Total $0.069071. One sample per level does not establish typical latency or consistency across subjects.

All three outputs were visually reviewed for rounded cartoon abstraction, loose graphite lines, open yellow shapes, foreground-only composition and purposeful differences in detail. The prompts preserve the original core style and paper rules while adding a separate photo contract. No original prompt edits.

An earlier three-request run selected the legacy local mini model. Its images were deleted and its metadata corrected and labelled invalid. Its $0.113483 Flare-rate estimate remains a conservative budget charge, not a mini invoice estimate. Cumulative conservative charge including prior experiments: $1.271843 of the approved $2 cap. No further paid calls are needed for this implementation.

## Asset manifest

All listed assets are local QA evidence, not approved marketing material. Owner review is pending.

- native-selected.png: final native photo composer, real picker, public two-dog photo, agent visually reviewed.
- native-initial.png: initial native text composer before selecting a photo, agent visually reviewed.
- native-large-text.png: native text composer at font scale 1.4, agent visually reviewed.
- native-loading-fixture.png: unchanged native waiting state, simulated generation, QA only.
- flare-live/simple.png, medium.png, detailed.png: actual Flare MEDIUM outputs with unchanged production paper correction, agent visually reviewed.
- flare-live/live-generation.json: request IDs, usage, times, estimated cost and output hashes.
- live/live-generation.json: invalid-model run metadata only. Excluded from quality review.

## Release boundaries

Implementation is on codex/photo-input. Web baseline is the deployed October 8 snapshot saved in fcd03f7. Native baseline is committed codex/visual-detail-levels source. Reconcile with any later native release changes before integration. No production environment, credentials, Play declarations, production deployment or publishing changed. Local main environment model/quality and its example were corrected with owner-authorized obsolete-config cleanup.

Before release: independent review, review Play Data safety for optional Photos input and provider retention, fixture-disabled production build, and a Play-installed actual photo generation including credit behavior. The current native loading artwork was inherited from the committed baseline; this feature does not approve it as a new loading direction.
