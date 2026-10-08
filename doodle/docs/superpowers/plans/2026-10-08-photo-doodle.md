# Photo Doodle implementation

Goal: Add the approved photo input to the existing composer on web and Android.

Architecture: A bounded, locally normalized photo replaces the text field. The existing generation route owns bot protection, native integrity and credit reservations for both inputs. Photo conversion has a separate prompt and provider edit function. Native integrity binds a domain-separated photo payload hash and the detail level. Standard text prompts and their generation function remain untouched.

Stack: Next.js 16.3.6, React, Sharp, OpenAI Images edits, Expo 57 system photo picker and image manipulator.

Spec: Owner selected option 1 and approved implementation in this conversation. Use a photo opens the system picker. Change replaces it; Remove restores the text draft. No extra mode tab, privacy modal or photo-specific privacy action. Keep existing loading and results. Normalize to 600px, one image, strip metadata. One credit per successful result. Preserve input through purchase, sign-in and recoverable errors.

Global constraints: Work inline. No production deployment or publishing. Use deployed web snapshot from October 8 and committed native source from visual-detail-levels. Never alter the standard prompt. Only MEDIUM Flare for live tests. Existing $2 cap has estimated $0.910711 remaining before integration testing. No photo payload in analytics, diagnostics, URLs or logs. Update privacy information and prepare store declaration changes.

Review focus: Validation before credit reservation, native hash binding, no duplicate submissions, local draft cleanup, photo and text restoration, translated accessible actions, RTL, narrow screens, font scaling, errors and picker cancellation.

## Tasks

1. Preserve production baseline. Read local Next route guide and current provider/picker documentation.
2. RED/GREEN: Exercise invalid bytes, oversized images, animated inputs, EXIF removal, aspect ratio and native payload binding. Implement normalization and separate conversion function using researched v3 prompts.
3. RED/GREEN: Verify route credit refund and successful finalization for photo input; reject ambiguous or malformed input. Reuse existing protected route.
4. Implement shared localized photo copy and web picker, preview, Remove, local draft persistence and busy/error states. Test text restoration and no upload before Create.
5. Add Expo system picker with camera/microphone permissions disabled. Wire native photo state, integrity hash, generation, retry and cleanup. Test request and coordinator behavior.
6. Run targeted and full checks. Inspect real desktop and phone-size web rendering, Android if tooling is available. Perform actual MEDIUM Flare conversion within remaining budget and record output, cost and timing.
7. Review complete diff inline, polish and record verification, limitations and store release prerequisites. Do not publish.

## Execution ledger

- Baseline preserved in fcd03f7. Managed checkout creation failed due to synced Git configuration, so a local Git worktree was created instead.
- Implementation complete locally. Web/native tests, typechecks, lint, default web production build and Android fixture build passed. Actual Flare MEDIUM conversion reviewed at all three levels. See docs/qa/photo-input-2026-10-08/design-qa.md for evidence, budget and release gates. No publishing authorized.
