# Android 0.1.9 build 14 release preparation

Source commit `2adfae6` is pushed on `codex/compact-detail-selector`. The signed AAB is preserved at the path and SHA256 in [status.json](status.json).

Google accepted version 14 on the existing internal testing track. Console readback says **Available to internal testers**. No supported devices were lost. Version 13 remains the last verified public production release. Version 14 has not been submitted to production.

Fresh native checks passed: 29 files, 276 tests, TypeScript, production bundleRelease and lintRelease. Artifact inspection verified the existing upload key, production API configuration, fixture mode disabled, unchanged permissions, API 36, all four ABIs, matching detail thumbnails, 16 KB LOAD alignment for every 64-bit library and PAGE_ALIGNMENT_16K bundle configuration. These static checks do not establish runtime device compatibility. The earlier actual native fixture layout checks remain documented in [detail QA](../detail-selector-2026-10-21/report.md).

Two real-provider probes used the current source generation functions with the configured Flare model, Medium quality, 1024 square output and no automatic retries. Pink text Medium and white photo Detailed both passed visual inspection. Estimated token cost is USD 0.038507 against the owner's EUR 1 total budget. [Usage and request IDs](provider-quality.json) distinguish this source-level output validation from native app requests. This is a two-case quality check, not exhaustive acceptance of every color and detail combination.

The owner approved the additional Google SDK ARM license. The official Play-enabled ARM64 API 36 revision 7 image is installed, and a separate local emulator `Doodle_Play_API_36_Mac` is running. No existing device/account data was reset. Google sign-in is currently at the existing reviewer's password screen. The Play Console credential value is protected from automation, so the owner was asked to finish sign-in locally. The login views will remain untouched until the owner says they are finished.

Pending before production: install version 14 from Play, verify installer/version/signing and native Integrity, fresh Doodle sign-in, native text/photo generation and balance changes, and appropriate billing/recovery regression checks. No store availability, native live generation or billing pass is claimed from fixture screens or the provider probes.
