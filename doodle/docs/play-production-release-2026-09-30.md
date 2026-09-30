# Google Play production release, 30 September 2026

Owner authorized submission of the tested build, approved the private refund cron key and deployment, and subsequently requested root execution inline. Publication status is recorded below after the actual Console submission.

## Exact Android artifact

- Package: `nl.samistudio.doodle`
- Version: `0.1.3`, code `5`
- Artifact: `mobile/artifacts/doodle-release-v5.aab`, 62,069,342 bytes
- SHA-256: `c59290bff96a5b4aed67a32793113566d657f160260a916b7b335da4204c694b`
- Actual emulator installer: `com.android.vending`; code 5, version 0.1.3, min SDK 24, target SDK 36 were read again before final testing.
- Production review contained this single bundle, zero errors and the optional missing R8 mapping warning. Production country coverage was saved as 178 targets including rest of world. Publishing overview queued build 5 full rollout plus the two country changes. Automatic quick checks finished and allowed submission. Managed publishing is off.

## Functional evidence

Physical-phone generation succeeded after a Google Play reinstall under normal owner Integrity checks. This is documented separately in `physical-phone-qa.json`; physical version/balance were not independently read from the phone.

The original Play-installed build 5 purchase test added ten credits, persisted after restart and showed successful delivery. The final current-backend test used Doodle's separate reviewer account and Google's approving test card, with an explicit no-charge notice. Google completed the order while the app was force-stopped before server credit delivery. Starting the app recovered it once, 19 to 29; another restart left 29. Google refunded the same test order with Remove entitlement. The deployed cron reversed ten credits once, 29 to 19. Replay deducted zero; residual review count was zero. Owner credits remained 23 during that test. Full details and timings are in `play-refund-scheduler-qa.md`.

Cancelling the initial checkout left the balance unchanged, but displayed the existing generic checkout-start error. This minor cancellation wording is recorded rather than being represented as clean cancellation UI.

A supplementary emulator generation attempt returned HTTP 403 before image generation on the final backend. Request `m8jjz-1790767013748-0c2d05502302` had `testingResponse=false`, valid package/hash/time checks but missing app recognition, certificate, licensing and device integrity. The emulator's Play account was the owner, intentionally excluded from testing overrides. This is an untrusted-emulator security rejection, distinct from the successful physical-phone generation. Owner Integrity protection was not weakened. A live web generation then completed on the final backend. The real settled astronaut result was visually inspected with a flat yellow background and no halo. Two HTTP 200 requests were recorded, sxrqk-1790767356138-e72595cc486e and bpxbd-1790767356956-1ecf84e3083d, using gpt-image-1-mini, medium, 1024x1024. The owner balance changed from 23 to 21 after this supplementary check. The source of the second request was not established, so this check does not claim one request or one credit. Screenshot final-live-web-generation.png preserves the real output. This is image-backend evidence, separate from native device attestation.

## Final backend

Deployment `dpl_2uKrrG5KusyPn5TQRDmhFfpviSTd` is READY and promoted to `https://doodle.samistudio.nl`. Source provenance is the previous 206 live files plus only the authenticated reconciliation route and `vercel.json`. The prompt, native configuration and Play verification hashes were unchanged. Daily refund reconciliation at 03:00 UTC is enabled and production apply/replay were actually exercised. A fresh independent security review passed before deployment. This does not claim a future scheduled run or an automatic alert subscription.

## Submission result

Submitted inline on 30 September 2026 at approximately 11:34 UTC. After the final Send changes for review action and successful automatic checks, the refreshed Console explicitly displayed Your changes are now in review. Its Production row is 5 (0.1.3), Start full rollout, with the two country changes. Managed publishing remains off, so approval will publish automatically. Public availability is not yet claimed. The actual rendered result was visually inspected and saved as play-production-submitted.png in C:\Users\Sami\.codex\doodle-android-preview\release-diagnosis. The Console result tab is preserved for the owner.

Disposable inline receipt snapshots, temporary deployment files and the local helper were removed after saving the minimal QA evidence. The final AAB, source, permanent tests and release screenshots were preserved.

On 30 September 2026, the owner explicitly approved enabling Doodle publishing emails. Saved App publishing updates as Emails on for 1 app. Reopened the saved picker and verified only Doodle was selected; Cryptik was unselected. The recipient displayed by Play Console is samicodesit@gmail.com. Saved visual proof: play-doodle-publishing-emails-enabled.png. Other notification categories were preserved.

## Production publication confirmed, 30 September 2026

Google Play Console submission 5 is now Published. Its details explicitly identify Production build 5 (0.1.3), Start full rollout, plus the two approved country coverage changes. The Console records submission at 13:33 and publication at 14:18 on 30 September 2026 (Europe/Amsterdam), approximately 45 minutes. The actual rendered details and publication notification were visually inspected. Final confirmation screenshot: C:\Users\Sami\.codex\doodle-android-preview\release-diagnosis\play-production-published.png. The published submission tab is preserved for the owner. Google's notification says users should see changes immediately, but this may take longer. This confirms production publication; no universal device propagation or new production-install functional test is claimed from the Console status alone.

Public store destination: https://play.google.com/store/apps/details?id=nl.samistudio.doodle