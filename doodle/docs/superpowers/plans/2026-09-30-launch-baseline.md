# Launch baseline implementation plan

> Execute inline using the planning and verification workflow. The owner has authorized the necessary work and requested simple inline execution.

**Goal:** Make the checked-out web source reproduce the live release and record the first useful launch measurements.

**Architecture:** Reconcile against Vercel's uploaded source manifest. Preserve local-only files and native cleanup. Use existing reporting surfaces before adding any telemetry or dependencies.

**Tech stack:** Next.js, Vercel, Google Play Console, Google Ads, Git.

**Spec:** Owner-approved four priorities in this conversation: source baseline, measurements, existing bounded campaign, reliability and abuse review.

## Constraints and review focus

- No new spending, credential changes, Android publication or speculative feature work.
- Preserve existing instruction files, secrets, generated files and unrelated local changes.
- Verify source hashes before restoration and preserve changed local versions for recovery.
- Never label testing activity as customers or delayed reporting as zero activity.
- Account for production-only payment and authentication fixes in validation.

## Tasks

- [x] Compare the current production manifest and the retained tested release with local source. Back up changed local files before restoring meaningful differences.
- [ ] Install the production lockfile dependencies, run web tests and production build, and save a scoped Git baseline without unrelated files or secrets.
- [x] Read the current campaign, Play acquisition/vitals and website reports. Record dates, measured values and unavailable metrics.
- [ ] Assess the smallest useful measurement approach, current failure/cost visibility and trial-abuse limits. Implement only a necessary, proportionate gap within the approved scope; record external blockers accurately.

## Verification

All runtime source files must match the deployed manifest. Existing web tests and build must pass. The scoped commit must contain only the release baseline and relevant delivery records. Reporting conclusions must identify their time window and provenance. Runtime changes, if needed, require targeted regression coverage and deployment approval already present in the owner's request only when clearly necessary for this scope.

## Execution decisions

- The owner clarified that main must be clean and reproduce production. Native source, unpublished cleanup, old TWA source and local promotional work will be preserved on `codex/doodle-next-update` in a separate managed worktree.
- Reconciliation restored 29 meaningful differences. All 217 non-generated source/release files now match the live upload by exact SHA1; current instruction files and generated metadata are intentionally excluded from runtime equivalence.
- Fresh validation: 474 web tests passed, one opt-in live image test skipped; the production build passed. No real payment or image generation was needed because this restores already-live source.
- Use existing reporting before adding runtime telemetry. Native first-doodle conversion remains explicitly unmeasured, rather than claiming website analytics measures it.
