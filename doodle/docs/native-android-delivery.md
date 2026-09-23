# Native Android delivery record

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

- [Signed release AAB](../mobile/artifacts/doodle-release-v2.aab), package `nl.samistudio.doodle`, version code 2, version name `0.1.0`, SHA-256 `293c0cadee4f2c741765a093b9c43119d7aac40cc1c952ff2ba6dc8478a1c8d4`, 61,241,247 bytes.
- [Isolated fixture APK](../mobile/artifacts/doodle-fixture.apk), package `nl.samistudio.doodle.fixture`, SHA-256 `02a08c5b22323f3ceed6761e01921939fade45d5dc21593ca7762a31b2552b36`, 40,447,831 bytes.
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
