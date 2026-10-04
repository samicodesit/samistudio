# Backend paper color correction

Owner approved guarded correction on 2026-10-04 after reviewing six saved HIGH outputs. Implemented in the detail-level feature worktree. No production deployment or Android publishing occurred for this change.

`generateDoodle` corrects the provider PNG once before returning it to `/api/generate`. The HTTP response remains an uncached PNG. Both web and existing Android clients receive the same bytes for preview, download, and sharing. Model settings, prompts, Integrity binding, credit reservation/finalization, and client loading behavior are unchanged. Generated images are not automatically saved centrally.

The helper decodes a maximum 8 MiB, 1024 by 1024, single-frame, 8-bit RGB PNG. Embedded color profiles, grayscale and rotated images pass through unchanged. Transparent images, significant non-yellow colored content, insufficient yellow paper, broad paper variation, and large color drift also pass through unchanged. The gates are conservative heuristics, not semantic understanding of a drawing.

For eligible images, it estimates the median yellow-paper RGB, calculates the difference from `#FFEB8A`, and shifts warm pixels with a smooth brightness weight. Pixels with maximum RGB below 120 are untouched. Alpha and geometry are unchanged. The helper checks the corrected sampled paper median is within one channel value of the target before encoding. It never regenerates a drawing. Any processing or encoding failure returns the original bytes successfully. Exact target paper needs no re-encoding.

The method retains visible grain and reviewed hatching/fills. Light ink edges can change slightly. Bright red-channel values clip at 255, so some texture variation is reduced. Yellow or brown subject fills cannot always be distinguished from paper. This is why uncertain images are bypassed and the behavior should be monitored after release.

Correction status, fixed version `paper-v1`, and bounded duration are copied into existing correlated generation diagnostics. Scenes, image bytes, arbitrary exception messages, and additional attached fields are excluded. Successful requests retain the existing bounded console logging and do not create extra Redis failure records. No new analytics service, image queue, separate function, or hosted correction endpoint is introduced.

`DOODLE_PAPER_CORRECTION=off` bypasses processing for rollback. Unset means correction is enabled. Changing production environment settings still requires deployment approval. The existing Sharp 0.35.4 package is now a directly declared runtime dependency at the same version, rather than relying on Next's optional transitive dependency. Next automatically externalizes Sharp; no bundler configuration changes are needed.

Verification:

- Test-first run observed missing correction, fallback statuses, integration, and metadata behavior fail. Final full suite: 611 passed, one paid-generation test skipped.
- All six actual saved HIGH provider outputs match the reviewed corrected PNG pixels exactly. Protected dark ink and alpha are verified unchanged. See [backend verification](qa/detail-levels/comparisons/paper-color-trial/backend-verification.json).
- Tests cover exact target pass-through, light-edge weighting, colored and transparent content, broad variation, excessive drift, dimensions and file size, malformed data, processor and encoder failures, disable switch, sanitized diagnostics, and paid/free credit delivery on success and fallback.
- `npm run typecheck`: passed. `npm run lint`: zero errors, two existing image-element warnings in card-composer.
- `npm run build -- --webpack`: passed. Default Turbopack build hit the existing worktree's external node_modules symlink boundary; Webpack is the same production-build mode used by prior feature QA. Compiled code externalizes Sharp. The local trace lists the shared node_modules symlink rather than individual native files, so clean-install deployment tracing remains to be verified before release.
- Running the actual helper locally on the six saved PNGs averaged 157 ms in the first run and 217 ms while the final suite also ran. This is local Node 26.9.0 timing, not measured Vercel latency. No new provider calls were made.

Inline final review checked the failure boundary, original-buffer immutability, alpha and dark-ink preservation, RGB channel assumptions, input bounds, import isolation, diagnostic allowlisting, and unchanged HTTP/credit contracts. This is author review; independent release review remains pending.

Before production release, verify the deployed runtime and an installed Android result, obtain independent release review and separate deployment approval, and keep the broader detail-level release gates in [detail-levels](detail-levels.md). No claim of live production correction is made from local or fixture checks.
