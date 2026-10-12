# Native Android delivery record

## Current checkpoint, 10 October 2026

Code12 (0.1.8), Photos, packs, recovery, is submitted for production full rollout with the combined store description and Data safety update. Google quick checks passed. Console states Your changes are now in review; public availability is not yet confirmed. Web/mobile web and backend already have matching packs and photos live. Actual Play-installed code12 fresh Google sign-in, text and photo generation passed under the existing dedicated reviewer test responses, production checks unchanged. This is distinct from prior physical-phone evidence. Current delivery, tests, budget and submission evidence: docs/qa/combined-release-2026-10-10/report.md and play-production-submission.json in that directory.

## Historical delivery timeline

Use [Android release testing](android-release-testing.md) for reusable instructions. The dated entries below retain their original versions, limits and gates; they do not override the current checkpoint.

Date: 10 September 2026

This record covers the final native integration fixes and local Android packaging completed for Doodle. The web app remains a separate product surface.

## Changes verified

- Native purchase presentation now restores localized title, quantity, terms and labels when the reducer contains empty placeholder fields.
- Exhausted-trial checkout prepares the billing connection before showing the offer, so the store price is visible before payment.
- The signed-in purchase offer no longer shows the signed-out restore prompt.
- The fixture runtime starts signed in with zero paid credits and two free doodles. A first generation leaves one free doodle, a second leaves zero, and the next attempt opens the prepared offer.
- `mobile/scripts/build-fixture.mjs` keeps the fixture flag explicit and builds the isolated fixture package without a Metro dependency.

## Checks

- Mobile tests: 13 files, 47 tests passed.
- Mobile TypeScript check: passed.
- Fixture build: `npm run build:fixture`, Gradle build successful.
- Fixture helper syntax check: `node --check scripts/build-fixture.mjs`, passed.
- Release build: `NODE_ENV=production EXPO_PUBLIC_NATIVE_FIXTURE_MODE=false ./android/gradlew -p android :app:bundleRelease --no-daemon`, successful.

## Production backend deployment

- On 10 September 2026, the current `doodle/` working tree was deployed through the linked Vercel project. Deployment `BTWzVddUT131VbwUcAQ8sJq9Rgwp` is live at `https://doodle-j2vcn1h07-ahmed-samis-projects-e6ef0336.vercel.app` and is aliased to `https://doodle.samistudio.nl`.
- The attestation decoder was corrected to consume the object-valued `tokenPayloadExternal` returned by the Play Integrity API. The certificate setting was corrected to the URL-safe base64 representation returned by Play. The latest production deployment is `dpl_4MhyYA1nMkgtg8GyWsrWyQJ3srqd`, and its build completed successfully.
- A follow-up production deployment `dpl_BLQ4xiLnVqDbPU9vtTZQpTYaXK2L` added a redacted `testingResponse` boolean to the invalid-verdict diagnostic. Its build completed successfully and the alias was applied to `https://doodle.samistudio.nl`.
- The Vercel build route table includes `/api/native/config`, `/api/native/attestation/challenge`, `/api/native/auth/google`, `/api/native/auth/sign-out` and `/api/native/session/guest`. The project ignore rules excluded mobile and Android artifacts, documentation, marketing assets, reports and environment files while retaining the application source.
- These four production settings were added as non-secret configuration values:
  - `NATIVE_ATTESTATION_ENABLED=true`
  - `PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=368967912119`
  - `PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS=true`
  - `PLAY_INTEGRITY_CERTIFICATE_SHA256=vTG-JahXPGXgAgau5MpHK1m_pArNJXKJ6kk5WISRPmQ`
- The existing `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_ACCOUNT_LINK_SECRET` and `PLAY_BILLING_ENABLED` production values were retained. No credential values are stored in this record.
- Read-only production checks passed: native config returned HTTP 200 with `enabled:true`, package `nl.samistudio.doodle`, minimum version code 2, Play Integrity, guest enabled and project number `368967912119`; the web home returned HTTP 200; Digital Asset Links returned HTTP 200 with the expected Play signing fingerprint; anonymous Play config remained HTTP 401.
- Local backend verification passed with `npm run typecheck`, targeted ESLint and 14 native/shared route test files containing 126 passing tests.
- A Play-installed v2 retry reached the decoder and returned HTTP 403 with the paid balance unchanged at 20. The server diagnostic showed matching request package, request hash and timestamp, but unevaluated app, certificate, licensing and device checks on the current Play AVD. No credit was debited. Native generation remains unverified until a certified physical device or a configured Play Integrity test response is used.
- After the Play Store account and Internal v2 installation were confirmed for the dedicated reviewer, one controlled retry at `2026-09-10T08:02:23.423Z` still returned HTTP 403 with `testingResponse:false` and the same verdict pattern. This proves the configured test response did not reach that request. No credit was debited. No further retries were made.
- Play Console's documented Play Integrity testing feature is scoped to the email addresses selected by the developer. Google marks those responses with `testingDetails.isTestingResponse=true`; this metadata is informational and is ignored by the verifier. A configured pass response must still contain the exact package, request hash and fresh timestamp, the configured certificate digest, `PLAY_RECOGNIZED`, `LICENSED` and `MEETS_DEVICE_INTEGRITY` values. Selecting test responses for the dedicated review account must not be treated as production-device evidence.

## Native operational limits

- The current Play AVD returned unevaluated app, certificate, licensing and device verdicts even though the request binding checks passed. This is an expected limitation of that test environment, not a successful live attestation. A certified physical Android device installed from Google Play, or the explicitly configured per-account Play Integrity test response, is required for the next end to end verification.
- Native guest access keeps the existing two finalized uses and 600-second generation holds.
- Guest generation remains limited to 20 requests per client per UTC day and 200 requests globally per UTC day.
- Attestation challenge issuance has separate limits of 20 per client and operation per UTC day plus 200 globally per UTC day. Each challenge is single-use and stored for 300 seconds.
- Native bearer sessions use the existing 2,592,000-second session lifetime.

The deployment proves configuration and route behavior only. A live Play Integrity verdict, Google Sign-In exchange, server generation, real Play purchase and Play-installed end-to-end run remain unverified until the Internal v2 build is tested.

## Play Console draft

- The signed version code 2 AAB is saved in the Internal testing track as the draft release `Native v2 internal QA`. Closed Alpha remains on version code 1.
- Play's preview reports two device coverage warnings because this native bundle supports API 24+ while the previous bundle supported API 23+. The reported reduction is 856 phones, 157 tablets, 4 TVs and 17 cars. No newly supported devices are added. This was accepted for the current native dependency baseline, and min SDK was not lowered blindly.
- The draft has not been published. Internal rollout remains gated on live native backend, authentication, Play Integrity and billing verification.

## Artifacts

- Historical signed release AAB `doodle-release-v2.aab` (superseded artifact, no longer retained), package `nl.samistudio.doodle`, version code 2, version name `0.1.0`, SHA-256 `293c0cadee4f2c741765a093b9c43119d7aac40cc1c952ff2ba6dc8478a1c8d4`, 61,241,247 bytes.
- Historical isolated fixture APK `doodle-fixture.apk` (superseded artifact, no longer retained), package `nl.samistudio.doodle.fixture`, SHA-256 `02a08c5b22323f3ceed6761e01921939fade45d5dc21593ca7762a31b2552b36`, 40,447,831 bytes.
- The AAB JAR signature was verified. Its upload certificate is `CN=Doodle Upload Key`, SHA-1 `44:D6:07:FE:0D:B6:BC:19:9E:12:6A:51:F8:CE:A0:64:62:3E:45:54`.
- The AAB contains `arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64` native libraries.
- Embedded Expo config confirms API base `https://doodle.samistudio.nl` and `nativeFixtureMode: false`.
- The merged release manifest omits `READ_MEDIA_IMAGES`, `READ_MEDIA_VISUAL_USER_SELECTED` and `SYSTEM_ALERT_WINDOW`. It retains legacy storage permissions capped at API 32, plus the permissions required by the app and its packaged libraries.

## Rendered evidence

Fresh direct-launch captures came from the isolated `Doodle_API_36` emulator at 1080 x 2400, density 420. The Play-installed package and its data were left untouched.

- `C:\Users\Sami\.codex\doodle-android-preview\native-final-fixture-signedin-20260910.png`
- `C:\Users\Sami\.codex\doodle-android-preview\native-final-fixture-loading-20260910.png`
- `C:\Users\Sami\.codex\doodle-android-preview\native-final-fixture-result-20260910.png`
- `C:\Users\Sami\.codex\doodle-android-preview\native-final-fixture-result-free0-20260910.png`
- `C:\Users\Sami\.codex\doodle-android-preview\native-final-fixture-purchase-gated-20260910.png`

The captures show the brand fonts, generous rotating loading card, result actions, safe-area spacing, correct free counter, and the compact purchase offer. The final purchase capture shows the price and hides the signed-in restore prompt.

The final polished fixture pass was run after the painted-sheet fix on the isolated `emulator-5556` fixture device. The accepted fixture APK is `C:\Users\Sami\.codex\doodle-android-preview\artifacts\doodle-fixture-moss-sheet-painted-final-20260910T113617Z.apk`, 40,828,971 bytes, SHA-256 `90B72B17B57CA84550926E885C0AA0EF84041D1F6B6C04A06195549C0B06D778`. It is package `nl.samistudio.doodle.fixture` and is separate from the Play package.

Fresh rendered evidence from that pass:

- Loading motion clip: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-moss-waiting-20260910T1127Z.mp4`, with its contact sheet in the adjacent `fixture-moss-waiting-20260910T1127Z-frames` directory. The card remains steady while the moss stroke and black brush progress. The sampled copy changes from `Clearing a fresh note...` to `Sketching the main shapes...`.
- Sheet opening clip: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-sheet-opening-painted-20260910T1142Z.mp4`; dense 20 fps transition frames: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-sheet-opening-painted-20260910T1142Z-dense.png`. The scrim and paper enter together, with no blank paper over an undimmed page.
- Reduced-motion frames at 1.5 and 3 seconds: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-reduced-motion-late-1p5s-20260910T1149Z.png` and `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-reduced-motion-late-3s-20260910T1149Z.png`. Both are identical and show the moss stroke and black brush held still on the card.
- Correct narrow result capture: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-painted-result-narrow-actual-840x1867-20260910T1209Z.png`. The PNG is verified at 840 x 1867 while the emulator override was active, approximately 320 dp at density 420. The result image, stacked actions, secondary actions, counter and bottom tabs fit without clipping or gesture overlap. The earlier 1080 x 2400 file labelled as narrow is disregarded.
- A no-IME report Back check returned to the result screen with no crash lines in logcat. A separate focused-field attempt exposed only the emulator's floating input toolbar and no software keyboard grid, despite `mInputShown=true`; its Back key reached Android home. Keyboard dismissal and sheet retention therefore remain unverified on this AVD, and no report was submitted.

## Limits of this evidence

The fixture package uses a local simulated account, generation delay and billing adapter. It proves the native state and presentation flows, but it does not prove live server generation, Google Sign-In, Play Integrity, a real Play purchase, or Play-installed behavior. The signed AAB was built and signed locally, then uploaded to an unpublished Internal testing draft. It has not been rolled out to testers.

Superseded diagnostic captures and intermediate purchase screenshots created during this pass were removed. The final APK, AAB and accepted evidence above were retained.

## Final responsive typography pass

- The final isolated fixture build completed with `npm run build:fixture` after the responsive typography and Ideas image-centering changes. APK: `C:\Users\Sami\.codex\doodle-android-preview\artifacts\doodle-fixture-final-image-centered-20260910T1210Z.apk`, 40,830,219 bytes, SHA-256 `26AD7237E11CBC30C847B2D2089AA5B9D2E04E05C388A6ADE2E2328DB0944B1D`.
- Fresh Create 320 dp capture: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-final-image-centered-create-320dp-20260910T1210Z.png`, verified 840 x 1867, SHA-256 `7D1842F28A02688AF5F4295CDEC923127E3AF1598DC6D05F0A317F292A80CE2F`.
- Fresh Ideas 320 dp capture: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-final-image-centered-ideas-320dp-20260910T1210Z.png`, verified 840 x 1867, SHA-256 `BFF8CFC92ECF43161737D636C3BFBA077F016C2F62B44FC4D4F978C15C6EDDB7`.
- Fresh Create 411 dp capture: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-final-image-centered-create-411dp-20260910T1210Z.png`, verified 1080 x 2400, SHA-256 `F52AF52DFE6165B31E1F3742E5C9A6FA34F5CA8FBAA016FBAF7A3C263B8FB594`.
- Fresh Ideas 411 dp capture: `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-final-image-centered-ideas-411dp-20260910T1210Z.png`, verified 1080 x 2400, SHA-256 `3D82AFE5D7E1E2D92A8D2B2E4F28E5AABCDDD88C7A377062411C176E5244210F`.
- The selected-idea Create behavior remains verified at 320 dp in `C:\Users\Sami\.codex\doodle-android-preview\qa\fixture-final-selected-create-320dp-20260910T1206Z.png`, verified 840 x 1867, SHA-256 `8C8E2FE621494163013F43EE95E5AE2697CC41EE0B486358A179C5CE4586E7F9`.
- The final captures show the reduced narrow heading, readable helper and prompt text, full-width Ideas cards, vertically centered artwork, and no clipping or unsafe bottom overlap. The display override was reset after capture and verified at the physical 1080 x 2400 size.
- The canonical generation prompt guidance was reviewed and has focused tests, typecheck and lint coverage. It was not deployed in this native capture pass, and no new live generation comparison is claimed.

## Live web generation evidence and current Play status

- A production web run with the exact prompt `playing video games` completed at approximately `2026-09-10T11:18:25Z`. The visible result was a person holding a controller facing a monitor. Balance changed from 12 to 11. PNG: `C:\Users\Sami\.codex\doodle-live-evidence\exact-playing-video-games-general-baseline.png`, SHA-256 `D8D9CE5B56DEF17FA23B5E8C29CDD288D464FB2996724FDAB4E2EDF16C325AE1`.
- A separate production web run with the exact prompt `a sleepy cat curled up` completed at approximately `2026-09-10T11:29:19Z`. The visible result was a curled-up sleeping cat with closed eyes, sleep marks and a heart. Balance changed from 11 to 10. PNG: `C:\Users\Sami\.codex\doodle-live-evidence\sleepy-cat-curled-up.png`, SHA-256 `A8863B433C1152810322399EA2A754A1F9F9C132B995A40285005B6F7C589F58`.
- These two checks verify the live web generation path and distinct provider outputs only. They do not verify native Android generation, Play Integrity, or Play-installed behavior. The native fixture output was not used as evidence for those claims.
- The earlier Play Console check during the live-web evidence run showed Closed testing Alpha release `3 (0.1.1)` as `In review`; the later approval and tester-service status are recorded below.

## Latest Play and tester service status

- The Play Console now shows Closed testing Alpha release `3 (0.1.1)` as `Available to selected testers`, released on 10 September 2026. The track is active in 177 countries and regions.
- The existing Testers Community Starter submission was submitted after v3 became available. The final form was visually checked with the Doodle name, Starter 15 tester plan, official Play opt-in URL and Doodle icon. The dashboard now shows one active app at Day 0 of 16, 0% complete, with reports pending.
- The form no longer exposes the shared reviewer Google account. It tells testers that no app login is required, two doodles are free, they should use their own Google account for Play opt-in and installation, and no purchase is required.
- Testers Community's own in-app purchase guidance says testers use their own Google accounts and Google's simulated test cards. The group is present in the Closed Alpha tester source, but the account-level License testing page still has only the owner email list selected, so paid purchase testing is not promised by this submission. The initial tester brief covers the two free generations and the surrounding create, download, share and return flows.

## Current closed-test progress: 10 September 2026, 20:21 CEST

- Testers Community reports the submitted Starter run as active with 15 of 15 testers, Day 1 of 16, 0% complete and 0 of 2 reports ready. Both reports are pending and no tester failure or feedback message is shown.
- Its Instructions page repeats the no-login, two-free-doodle brief and asks for 2 to 3 app updates during its 16-day service window. That service instruction is recorded separately from Google's Play requirement.
- Play Console's app dashboard marks `Have at least 12 testers opted-in to your closed test` as completed. The current Play UI does not expose the exact opt-in count or individual opt-in dates in this view. The separate `Run your closed test with at least 12 testers, for at least 14 days` task remains incomplete, so the qualifying period is still running.
- The Play account home shows `Installed audience 0`; this is an audience metric and is not treated as the closed-test opt-in count. The account banner confirms that all apps are registered for Android developer verification. Notifications include `App update published` for 10 September and `Your identity has been verified successfully` for 7 September. No blocking notification is present.
- The current Alpha track is active with release `3 (0.1.1)` serving. The track's tester source contains `testers-community@googlegroups.com` and `doodle-android-testers-2026@googlegroups.com`. Play also shows non-blocking next-release guidance about deprecated edge-to-edge APIs and large-screen resizability.

## Release QA snapshot: 30 September 2026

- Play Console production access is granted. Production remains inactive. Closed Alpha release 3, version 0.1.1, is active at 100 percent, with no newer release shown.
- The Play-installed emulator candidate is now `nl.samistudio.doodle`, version name `0.1.1`, version code `3`, installed by `com.android.vending` on `emulator-5556`. The package metadata was read with ADB port 5038. Evidence captures: `C:\Users\Sami\.codex\doodle-android-preview\native-play-code3.png` and `C:\Users\Sami\.codex\doodle-android-preview\play-store-current.png`.
- A native production generation request reached the backend but returned HTTP 403 `native_attestation_invalid`. The request package, hash and timestamp checks passed. App, device, license and certificate verdicts were unevaluated or failed, with no debit (balance 7 to 7). This is an emulator trust limitation and does not prove a signing misconfiguration. The production certificate setting matches the documented Play certificate. The loading evidence is `C:\Users\Sami\.codex\doodle-android-preview\native-generation-loading.png`.
- A separate production web generation completed and was visually inspected. Balance changed from 8 to 7. This verifies the live web path only, not native attestation.
- The local Stripe checkout change matches the Autolister approach: `src/lib/billing/checkout.ts:24-29` keeps the configured Price ID and `adaptive_pricing: { enabled: false }` while omitting `automatic_tax`; `src/lib/billing/checkout.test.ts:42-71` asserts the exact payload without `automatic_tax`. This is local evidence only and has not been deployed.
- Local checks passed: focused suite, 13 files; full suite, 424 passed and 1 intentionally skipped; typecheck passed; lint passed with four existing warnings. Warnings are `marketing-assets/birthday-short-2026-09-12/build-birthday-short.mjs:118:7` (`hookBase` unused), `src/components/card-composer.tsx:158:26` and `:159:51` (`no-img-element`), and `store-assets/android-captures/prepare-assets.mjs:36:7` (`sheet` unused).
- The Google Play billing sheet used the always-approves test card and completed one zero-charge payment successfully. Production `/api/play/verify` returned HTTP 403 `purchase_account_mismatch`; balance remained 7 to 7, with no credit grant and no replay. Evidence: `C:\Users\Sami\.codex\doodle-android-preview\native-google-billing-final.png` and `C:\Users\Sami\.codex\doodle-android-preview\native-google-billing-result.png`. The downloader account is not recorded as a proven root cause; binding diagnosis remains open.


## Inline payment diagnosis and corrected candidate: 30 September 2026

- Work continued inline at the owner's request. No additional delegated execution was used.
- The actual Play-installed version 3 base APK was pulled and its Hermes bytecode inspected. Its prepared billing branch returns the cached product and account binding. It contains one config fetch in the billing preparation function. The current source refreshes the config and account binding when preparation is reused.
- A regression check temporarily restored the shipped behavior and failed the account-switch test with `purchase_rejected` (exit 1). The exact fixed source was restored. The billing suite passed all 7 tests. The complete native suite passed all 51 tests across 13 files, and native typecheck passed.
- Google Publisher API readback found the failed zero-charge license-test receipt. It includes a 64-character account binding, is cancelled after automatic refund, and remains unconsumed. The stored binding matches an active Doodle account under the current local Play signing secret, but does not match the owner's current native session. This supports a stale account binding diagnosis. A fresh receipt on the corrected Play-installed build is still required to establish the live fix.
- Candidate version name is `0.1.2`, version code `4`. Expo prebuild regenerated the Android project and synchronized the runtime string to `0.1.2`. The release Gradle build passed, including signing validation and release lint. JAR signature verification passed with the expected self-signed upload certificate warnings.
- Final candidate: `mobile/artifacts/doodle-release-v4.aab`, 62,069,254 bytes, SHA-256 `2a0bdb8ab0fe00cce2d51649980d7f87d38cd15b7c905c2f97454a94dde250d3`.
- The bundle's embedded configuration verifies package `nl.samistudio.doodle`, version code 4, production API `https://doodle.samistudio.nl`, Integrity cloud project `368967912119`, and `nativeFixtureMode: false`. The packaged billing preparation bytecode contains two config fetches, confirming the refresh fix is in this artifact. The merged release manifest targets API 36, includes Play Billing, and excludes modern gallery and overlay permissions.
- The owner account's Play opt-in page explicitly shows `You are a tester`. Missing owner enrolment is ruled out by that page.
- Positive Integrity test responses are configured for owner and reviewer accounts. A refreshed version 3 process still received a production response with `testingResponse: false` and failed app, license, certificate, and device checks. No attestation checks were weakened. This test configuration has not established a successful native generation path.
- Build 4 is prepared locally. It has not been uploaded or released on Play, and there is no production deployment. Native generation and receipt crediting are pending on a Play-installed corrected candidate. Google Play's new immediate-performance and withdrawal-rights `Agree` dialog is waiting for explicit action-time approval under the computer-use policy.

## Build 4 Internal testing rollout: 30 September 2026

- The owner instructed the agent to proceed with the live checks on one final candidate. That instruction was treated as authorization for the previously described build 4 Internal testing rollout. It does not authorize a production release.
- The uploaded bundle hash was rechecked before upload and matches the candidate SHA-256 recorded above. Play accepted version code 4, version name 0.1.2. Validation showed only a missing deobfuscation-file warning; the build does not enable R8 obfuscation.
- Build 4 was published to the existing Internal testing track. Play Console explicitly reports `Available to internal testers`, one version code, and latest release `4 (0.1.2)`. The result was visually inspected and saved as `C:\Users\Sami\.codex\doodle-android-preview\release-diagnosis\build4-internal-published.png`.
- The owner Gmail was not previously enrolled in the Internal testing program. The existing email list already included it. Its invite was accepted, and the enrollment page now explicitly states that the owner is a tester for the internal program. This is separate from the previously verified closed-test enrollment.
- The emulator's Play Store confirms the active account is `samicodesit@gmail.com`. The client still shows release 3 while the new release propagates. No result on that old package is being recorded as a build 4 live test.
- No production release or backend production deployment was performed. The old terms dialog was cancelled while preparing the update. Its acceptance is not recorded as authorized or completed.

## Space cleanup and direct signed candidate testing: 30 September 2026

- The owner requested removal of unused files. Obsolete Windows fixture APKs and the old version 3 upload copy were removed (370.3 MiB). Regenerable native app build output, local Gradle metadata, and Next.js build output were removed (approximately 2.31 GiB). Source, release records, minimal QA evidence, and the canonical version 4 AAB were preserved. Its SHA-256 was rechecked and still matches the recorded candidate.
- The Store still offered version 3 after a guest reboot and clearing its small temporary cache. Google Publisher generated APKs for uploaded version 4 were downloaded directly using the official generatedapks API. The selected API 29+ base, English, xxhdpi and x86_64 splits all pass APK signature verification and match the Play signing certificate. This direct update is distinct from a Play Store-delivered update.
- Android refused the update session due to insufficient internal storage. The test emulator had approximately 151 MiB free in a 6 GiB data disk. Normal Android cache trimming reclaimed no material space. The emulator was shut down and its data and encryption files are being backed up before a capacity adjustment. No app data or Google account was cleared. Native version 4 live results remain pending.
- Google documents license tester sideload support at https://developer.android.com/google/play/billing/test and signed bundle APK downloads at https://developers.google.com/android-publisher/api-ref/rest/v3/generatedapks/download (checked 30 September 2026).

## Cleanup result and current delivery blocker: 30 September 2026

- The inactive `Doodle_API_36` fixture emulator was removed along with its obsolete registration and the old version 2 bundle copy. Its directory had approximately 5.75 GiB of logical file lengths; one protected diagnostic remainder was left after removal failed and automatic approval review rejected forced removal. The active Play test AVD and source were preserved. C: free space now measures approximately 10.52 GiB. Earlier WSL build cleanup refers to free space inside the WSL filesystem, not an equivalent immediate reduction of the Windows VHD file.
- The active AVD data and encryption files were copied while stopped to `D:\Doodle-QA-storage-backup-20260930`; copy completion and exact file lengths were verified. Increasing qcow2 capacity from 6 to 8 GiB did not enlarge the guest ext4 filesystem. The backup is retained while the storage change is active.
- Unused YouTube, Drive, Photos and Google Search updates were removed from the dedicated test emulator using Android's supported uninstall-system-updates command. Their factory versions remain. Play Store, Play services, Chrome, Doodle and Google account data were not cleared. Guest free storage increased from approximately 151 MiB to 1.1 GiB.
- The selected Google-signed version 4 APK splits installed successfully. Package readback confirms version code 4, name 0.1.2, target SDK 36, and installerPackageName null. This was a direct ADB update, not a Play Store installation. No installer provenance was forged.
- Google automatic protection displays `Get this app from Play` and prevents use of the direct installation. Its Get app action opens the real Play listing with `Update from Play`. That action was attempted normally. Store diagnostics explicitly schedule version 3 and immediately consider the higher installed version satisfied, leaving version 4 with null installer provenance. This is an unresolved Store delivery blocker, not a successful generation or payment test. No protection was disabled.
- Play Integrity configuration readback confirms the linked project 368967912119 and the existing owner and reviewer test configurations. No configuration change was made in this check.
- Automatic approval review rejected opening the tester link in the emulator browser. No alternative browser control was used to bypass that rejection. Native version 4 generation, purchase crediting, and true Play Store delivery remain pending. No money was charged, and no production release or backend deployment occurred.

## Play-installed build 4 live results and final native corrections

- The owner gave full approval for the final tests. The Android release keeps the single Get 10 doodles button and Google Play checkout. Apple Pay is outside this Android release.
- The Store's local data was refreshed after small-cache clearing did not help. Google accounts, Play services and Doodle data were preserved. The Store then showed the correct September 30 build 4 notes. The direct-install package was removed with Android's keep-data option and installed using the actual Play Store Install button. Readback confirms version code 4, version 0.1.2, installer com.android.vending, last update 2026-09-30 10:08:57 device time. The owner account and balance survived.
- Native generation on that Play-installed build succeeded for `A tiny ghost drinking hot chocolate`. Production /api/generate returned HTTP 200 at 2026-09-30T08:11:35.696Z. The generated ghost holding a steaming mug was visually inspected. The result balance changed from 7 to 6. Evidence: release-diagnosis/v4-native-generation.png. Fixture mode is disabled. The configured Google account Integrity test responses remain active; this establishes native production-backend integration under that test configuration, not independent physical-device integrity certification.
- One Google Play always-approves test card order completed without a charge. Production /api/play/verify returned HTTP 200. Read-only ledger inspection confirms state consumed, created 2026-09-30T08:17:18.779Z, consumed 2026-09-30T08:17:19.572Z, and balance 16. Google purchase authentication was set to Yes, always on this dedicated test emulator when completing its post-purchase prompt. No password or credential was changed.
- The app nevertheless displayed a checkout error because it attempted client-side consumption after the server had consumed the receipt. The Account sheet also retained its pre-generation balance label. These are release blockers for the native experience.
- Three new regression cases reproduced the errors before the fix: granted and already_granted receipts rejected with ITEM_NOT_OWNED; Account sheet usage label stayed at 7 instead of 6. The native client now relies on final server grant statuses and does not consume those receipts again. The Account sheet and cached account summary are synchronized with generation usage. Pending and foreign receipt behavior remains guarded.
- After these changes, all 54 native tests across 13 files and native typecheck pass. Build 5, version 0.1.3, is being prepared with these final native fixes. Build 4 is not declared fully passing because its success presentation failed even though generation and server crediting worked.
- The unused fixture system image was also removed (4.27 GiB logical size), preserving the Play system image. The latest C: free-space reading is approximately 5.15 GiB, superseding the earlier transient 10.52 GiB reading. Guest free space remains approximately 1.1 GiB.

## Build 5 recovery after the desktop app crash

The interrupted Gradle build resumed successfully. `:app:bundleRelease :app:lintRelease` completed with BUILD SUCCESSFUL. Version 0.1.3, code 5 is signed and fixture mode is false. Embedded API is https://doodle.samistudio.nl and Integrity project is 368967912119. The canonical bundle is mobile/artifacts/doodle-release-v5.aab, 62,069,342 bytes, SHA-256 c59290bff96a5b4aed67a32793113566d657f160260a916b7b335da4204c694b. jarsigner verification passed; the Windows upload copy has the same hash.

Chrome file chooser control failed after the crash. The official Publisher API uploaded code 5 and returned the exact canonical SHA-256. The existing service account can stage the internal track but edits.validate and edits.commit returned HTTP 403. This API attempt is uncommitted and is not a published release. No permission expansion was performed. Console recovery is in progress. Play-installed build 5 generation and payment checks are still pending.

The Console upload was recovered using its native browser Upload button and the supported file chooser. The same canonical code 5 bundle was accepted. Console validation reported only the optional missing R8 deobfuscation file warning. No R8 obfuscation is enabled. Supported devices were unchanged. The owner-authorized Internal rollout completed on 30 September 2026 at 10:47 CEST. Console visibly shows latest release 5 (0.1.3), active and available to internal testers. Published rendering was inspected and captured at C:/Users/Sami/.codex/doodle-android-preview/release-diagnosis/build5-internal-published.png. Production remains inactive.

After clearing only the emulator Play Store local cache/data, the real Store offered Update with the new build 5 release notes. The actual Play Store update was started. No sideload or installer spoofing was used for this version.

## Final build 5 native acceptance, 30 September 2026

Version 0.1.3 (code 5) was updated using the real Google Play Store on emulator-5556. Android package metadata confirms installer com.android.vending, code 5, name 0.1.3, and last update 30 September 2026 at 10:50:36 CEST. Fixture mode is disabled, and both requests used the existing production backend.

- Actual native generation passed: prompt "A sleepy astronaut resting on the moon" produced the expected astronaut resting on a crescent moon. Production POST /api/generate returned HTTP 200 (request timestamp 2026-09-30T08:52:15.235Z). Balance changed from 16 to 15. The result and Account sheet both immediately showed 15, confirming the balance fix. The rendered output and loading UI were visually inspected.
- Actual Google Play license-test purchase passed: the Google sheet explicitly showed Test card, always approves and no charge. Google reported Payment successful. Production POST /api/play/verify returned HTTP 200 (request timestamp 2026-09-30T08:55:30.776Z). The server ledger was created at 08:55:31.289Z and consumed at 08:55:32.078Z, with balance 25. No receipt token or account identifier is reproduced here.
- Native purchase confirmation passed: the app displayed the checkmark, "10 doodles added", and Start drawing. The result balance changed from 15 to 25. The previous false checkout error did not occur. The single Get 10 doodles checkout uses Google Play; no Apple Pay button is included in this Android candidate.
- Persistence passed: after force-stopping and relaunching the app, samicodesit@gmail.com remained signed in and the Account sheet showed 25. No additional credits were granted on restart.
- Native regression suite: 54 tests across 13 files passed, and typecheck passed before compilation. Signed release bundle and release lint passed. No native source changes occurred after those checks, apart from the release version bump to 0.1.3/code 5.

Minimal visual evidence is preserved under C:/Users/Sami/.codex/doodle-android-preview/release-diagnosis/: build5-internal-published.png, v5-generating.png, v5-native-generation.png, v5-google-test-order.png, v5-native-purchase-success.png and v5-restarted-account.png. Each final rendering was visually inspected. This is functional Play-installed emulator evidence, not a fixture preview.

Scope: Google license testing means the purchase was not a real monetary charge. The emulator uses the existing Play Integrity test-account configuration; a physical-device integrity verdict was not validated. Native generation and Google Play receipt verification/consumption passed against production. No live Stripe webhook confirmation or Stripe charge is claimed from this Android test. The Autolister-style Stripe tax configuration change remains local and undeployed. At the completion of the build 5 checks, no production rollout or backend deployment had occurred. Promote the already-tested code 5 bundle when production publication is authorized; no rebuild is required.

Final housekeeping: removed obsolete Google-generated version 4 APK splits and redundant diagnostics (118.5 MiB), and removed the completed emulator storage rollback backup (6.03 GiB). Source, regression tests, final code 5 AAB, current emulator data and minimal evidence remain. Free space readback after cleanup was approximately C: 14.7 GiB and D: 13.02 GiB; emulator data had approximately 1.3 GiB free. The earlier protected fixture diagnostic remainder that automatic approval review rejected remains untouched.

## Backend paper-background correction

The owner identified a pale halo behind the astronaut doodle. Inspection confirmed the generated PNG contains the patch. The backend returns provider PNG bytes directly, and native rendering displays them without a background effect. Existing no-shading rules did not explicitly define uniform paper color.

Only a Paper background section was added in src/lib/generation/prompt.ts. It requires the entire square canvas to be the same evenly colored yellow paper, inside and outside object outlines, with uniform subtle texture. It forbids lighter patches, backing, halos, glow, spotlights, vignettes, gradients, washes, lighting effects, paper edges, tabletop, folds, curled corners and drop shadows. Existing style, subject isolation, composition and recognizability rules were preserved, including the recognizability rules confirmed in the existing production source snapshot. Model, runtime generation pipeline, response format, pricing, credits, payment code and mobile code were not changed.

Real provider evaluation used the same generateDoodle function as the backend. Initial local low-quality samples removed the halo, but one rendered a photographed paper edge and shadow. That sample was rejected and the paper wording was refined. Acceptance was based on two new actual provider images with the production profile: gpt-image-1-mini, medium, 1024x1024. Scenes were A sleepy astronaut resting on the moon and A tiny ghost drinking hot chocolate. Both were visually inspected and show continuous yellow backgrounds, no pale halo and no physical paper edge or shadow. This is a sampled check, not a guarantee that a probabilistic image model can never deviate. Evidence metadata and the complete tested prompt are in docs/generation-background-qa.json.

Focused prompt and generation tests passed (5 tests), and ESLint passed on the changed file. The production build and TypeScript check passed. A source comparison confirms all pre-existing drawing instructions are exactly preserved outside the new background section. At preparation time, this change was local and production-native output had not yet been validated against it. Build 5 remains the tested mobile candidate; this server-side prompt change requires no new Android build. Final evidence PNGs are halo-production-profile-1.png and halo-production-profile-2.png in the existing Windows release-diagnosis directory. Superseded local evaluation PNGs and the disposable evaluation script are removed after verification.
## Backend paper-background production deployment, 30 September 2026

The owner approved deployment. Production deployment dpl_cpR2ZxNeV5GFk7ty3E45ZdwWqpo8 is READY and assigned to https://doodle.samistudio.nl. The release reused the existing production source snapshot from dpl_58XMSUtTGH4eTU6658vuswLLzyWY and replaced only src/lib/generation/prompt.ts. Source retrieval after deployment confirmed 206 files in both snapshots, with exactly one changed hash. The published prompt SHA1 is 6b24c969adefab7b48655da7e9a311f6e58cf107. All payment, tax, credit, API and other source file hashes are identical to the preceding production deployment. Existing production settings and environment variables were inherited. The previous deployment remains available for rollback. The custom domain responded HTTP 200.

A fresh generation was then completed through the real Google Play-installed app, version 0.1.3/code 5, installer com.android.vending, using A sleepy astronaut resting on the moon. Production /api/generate returned HTTP 200 on the new deployment with gpt-image-1-mini, medium, 1024x1024. The actual settled result was visually inspected: even pale-yellow texture across the image, no light halo, physical paper edges or shadow. The balance changed correctly from 25 to 24. Screenshot halo-live-native-build5.png and metadata in generation-background-qa.json preserve the result. This is functional production-native emulator evidence. The earlier $0 Play purchase check remains applicable because payment source is unchanged; no new purchase was attempted. No Android rebuild or Google Play production rollout occurred in this backend deployment.

Disposable production-source retrieval files, deployment request/response files and log scratch files were removed after recording the deployment and verification evidence.
## Physical-phone integrity check prepared, 30 September 2026

The owner confirmed the physical Android phone uses samicodesit@gmail.com in Google Play. No physical phone was attached to ADB during setup; only emulator-5556 was connected. The confirmed Internal testing join URL is https://play.google.com/apps/internaltest/4701262981282017852. A QR code of that exact URL is preserved as doodle-phone-test-qr.png in the Windows release-diagnosis directory. Latest Internal release remains code 5/version 0.1.3.

Saved a new Doodle physical phone testing email list containing only samicodesit@gmail.com, and enabled that list on the Internal track. Removed samicodesit@gmail.com from Doodle owner testing after preserving installation access through the new list. The old owner list now contains only doodlereview889@gmail.com. The other override list, Doodle Integrity reviewer, was inspected and also contains only doodlereview889@gmail.com. The owner's phone account is therefore excluded from both existing simulated-verdict configurations; the separate reviewer/emulator account retains its existing configuration. No production publication, backend change, credential change or expanded security bypass occurred. Saved configuration rendering was visually inspected and preserved in phone-tester-setup.png.

Physical-phone installation, exact installed version, real device integrity verdict and generation remain pending. The owner has been given the QR code and asked to install or update through Google Play; no physical-phone success is claimed from setup alone. For manual testing, correlate the owner's reported action with production logs and credit changes. A fresh successful request after normal verdict propagation, with evidence of the Play-installed build, is required before closing this gap.

Console email entry required pressSequentially followed by Enter. Filling the visible email field and pressing Enter did not update the framework's email model; verify the account appears in the added-address grid before saving.
## Physical-phone request failed at Play licensing, 30 September 2026

The owner reported the latest Google Play-installed app displayed Doodle generation is temporarily unavailable. Production runtime request l2l9h-1790761582551-be29a8e204b0 on deployment dpl_cpR2ZxNeV5GFk7ty3E45ZdwWqpo8 returned HTTP 403 from /api/generate. The decoded attestation had testingResponse false. Request package, request hash, timestamp, Play app recognition, package, signing certificate and MEETS_DEVICE_INTEGRITY checks all passed. Only the LICENSED equality check failed. The logs do not record whether the exact licensing verdict was UNLICENSED or UNEVALUATED, so that distinction is not claimed.

This proves real device integrity and genuine app attestation passed, but end-to-end physical generation remains blocked by Google Play account entitlement. Source order verifies rejection occurred before reserving any doodle credit or contacting the image provider. Security requirements and production code remain unchanged. A possible account/install entitlement mismatch is being investigated; no account mismatch is yet established. Minimal evidence is recorded in physical-phone-qa.json. The app currently maps this attestation failure to a generic generation-unavailable message, which conceals the licence cause.
## Physical-phone generation passed after reinstall, 30 September 2026

The owner uninstalled and reinstalled Doodle through the verified Google Play Internal testing link, signed in with samicodesit@gmail.com, and reported 24 doodles remaining before retry. The owner then confirmed generation worked. Correlated production request zrl2v-1790762010778-f1e169da4081 at timestamp 1790762010778 returned HTTP 200 on the same deployment dpl_cpR2ZxNeV5GFk7ty3E45ZdwWqpo8, using gpt-image-1-mini, medium, 1024x1024. No server, mobile, credential, security-policy or override change occurred between the failed and successful requests. The Google Play reinstall resolved the observed licensing rejection; the underlying Google entitlement/cache cause is not independently established.

The earlier physical request explicitly proved normal real-device integrity and app/certificate checks with testingResponse false. The successful native generation passed the unchanged guard, which requires all of those checks plus LICENSED, while the owner account remained excluded from both simulated-verdict lists. This closes the physical-device generation gap with owner-reported Play installation and output, correlated production success, and unchanged guard/configuration evidence. The exact installed version and final balance were not independently read from the phone, and no physical-phone screenshot or new purchase was captured. Keep this evidence distinct from the independently observed emulator build 5 version, payment success and balance checks. Physical-phone QA details are in physical-phone-qa.json. No Google Play production submission or rollout occurred.

## Production submitted, 30 September 2026

The exact tested build 5 (0.1.3) was submitted for Production full rollout with the approved country coverage. Google Play Console completed automatic checks and explicitly displayed Your changes are now in review. Managed publishing is off. Public availability remains pending Google approval. The final backend daily refund job is deployed; zero-charge interrupted-purchase recovery, one-time refund reversal and idempotent replay passed inline. See play-production-release-2026-09-30.md and play-refund-scheduler-qa.md for artifact hashes, evidence distinctions, limitations and the actual submission result. The confirmation screenshot is play-production-submitted.png in the local release-diagnosis directory.

Production publication was confirmed in Console on 30 September 2026 at 14:18 Europe/Amsterdam. Submission 5 explicitly contains build 5 (0.1.3), full rollout and the approved country changes. See play-production-release-2026-09-30.md for the visually verified Published status and saved confirmation.
