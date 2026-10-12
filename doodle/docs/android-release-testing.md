# Android release testing

Procedure consolidated 10 October 2026 from observed Play-installed testing. Use this procedure for future releases and a dated QA directory for each release's results. Historical setup notes are evidence, not a current checklist.

## Start from the right source and artifact

- `mobile/` is the native Android source. `android/` is the historical Bubblewrap wrapper and must not supply a new native release or replace the Play-installed test app.
- Locate the source checkout and signed AAB in the latest release record before editing or building. Preserve other checkouts' uncommitted work. For the 10 October candidate the source is `C:\Users\Sami\.codex\worktrees\android-doodle-packs\samistudio\doodle`; its WSL build mirror is `/home/mests/.codex/doodle-packs-qa-20261010`. A build mirror is not the source of truth.
- Recheck Console's highest uploaded version code and choose the next unused code. Do not reuse a number from a plan or historical record. Inspect package, version, signature, production API, Integrity project, fixture flag, permissions and changed modules in the final signed AAB. Match the tested artifact hash to the promoted artifact.
- Current release evidence: [combined release report](qa/combined-release-2026-10-10/report.md). At the last 10 October readback, code 12 (0.1.8) was in review and code 9 was the last confirmed public version. Re-read Console before asserting any later status.

## Check accounts before debugging Integrity

Play Store account selection and Doodle sign-in are separate. Signing into Doodle does not select Play Store's account. Check the actual Play Store profile, test-track eligibility, license-testing membership and Integrity test-response email membership separately. A list's name is not proof of its members. The Doodle account is the credit recipient and may differ from the Play account; record the intended recipient.

The existing emulator integration account is `doodlereview889@gmail.com` (Doodle Review). On 10 October the read-only Console check confirmed the existing `Doodle reviewer Play response`, list `Doodle Integrity reviewer`, had that one member and positive `LICENSED`, `PLAY_RECOGNIZED` and `MEETS_DEVICE_INTEGRITY` test responses. The owner account `samicodesit@gmail.com` was deliberately excluded from the Integrity test-response lists for normal physical-phone testing. Do not add it back as an emulator fix. Recheck actual membership each release without changing configuration unnecessarily. Keep passwords and purchase tokens outside repository records.

Also expand the Google purchase dialog to check its billing account. On a multi-account device Google normally uses the account that downloaded the app, or the first account if none downloaded it. Switching the visible Store profile alone is not proof that checkout changed accounts. Internal-track access alone does not make purchases free; verify the license-test instrument and no-charge notice in each checkout. [Google billing test guidance](https://developer.android.com/google/play/billing/test).

The code 12 failure happened while Play Store selected the owner and Doodle selected the reviewer. Restoring the existing reviewer Play profile resolved the integration block without changing production checks or test-response settings. Owner approval was obtained for the tester's Play Terms acceptance. Optional Play offers were declined. That approval is a recorded action, not blanket authority for future account or credential changes.

Install or update from the internal track using the eligible Play account. Verify the installed version and `installer=com.android.vending`. Compare the installed Play signing digest, not the upload-key digest, with the backend allowlist. Check package, cloud project and server rejection diagnostics before proposing security changes. Do not fake installation or weaken package, request binding, certificate, licensing or device checks to make an emulator pass.

Account-scoped Google test responses prove the integration path when the unchanged guard succeeds. They do not certify emulator hardware. A fresh physical-phone check is a separate check when the release requires normal-device evidence; it is not the only way to test this integration. Prior phone evidence must keep its original date, observed scope and limits.

## Windows emulator and reliable captures

This machine's validated Play AVD is `Doodle_Play_API_36`, serial `emulator-5556`, Windows adb port `5038`. Port `5037` previously belonged to a WSL relay. Verify devices before targeting a serial. These are observed local settings, not universal defaults.

```powershell
$qaAdb = 'C:\Users\Sami\.codex\doodle-android-preview\sdk\platform-tools\adb.exe'
& $qaAdb -P 5038 devices -l
& $qaAdb -P 5038 -s emulator-5556 shell getprop sys.boot_completed
& $qaAdb -P 5038 -s emulator-5556 shell dumpsys package nl.samistudio.doodle
```

If Play Store or System UI hangs, first inspect fresh state and try a bounded app restart. If the guest remains hung, a full emulator restart restored it on 10 October after a guest-only reboot failed. Confirm no in-flight purchase or generation before interrupting it, unless interruption is the explicitly controlled test. Keep account and app data intact.

```powershell
& $qaAdb -P 5038 -s emulator-5556 emu kill
# Wait for that emulator process to exit before launching the same AVD.
$env:ANDROID_AVD_HOME = 'C:\Users\Sami\.codex\doodle-android-preview\avd'
Start-Process -FilePath 'C:\Users\Sami\.codex\doodle-android-preview\sdk\emulator\emulator.exe' `
  -ArgumentList @('-avd','Doodle_Play_API_36','-port','5556','-no-snapshot','-no-boot-anim','-gpu','swiftshader','-camera-back','none','-camera-front','none','-no-audio','-no-metrics','-no-window') `
  -WindowStyle Hidden
```

Wait in bounded intervals for `sys.boot_completed=1`, then inspect a fresh UI capture. Do not wipe the AVD, clear app data, reset accounts or reinstall a debug APK as routine recovery. The old `start-preview.ps1` installs the historical wrapper; it is unsuitable for preserving a Play-installed native candidate.

UIAutomator can briefly report `null root node` after an activity transition, sometimes with exit code zero. Use a unique dump name, verify the fresh XML exists and parses, and never fall back silently to an old dump or repeat taps from stale coordinates. Use a fresh screenshot when needed. Capture binary screenshots through device storage and `adb pull`, not PowerShell text redirection:

```powershell
# Set this to a unique absolute path in the current release's owned QA directory.
$qaLocalPath = 'C:\Users\Sami\AppData\Local\Temp\doodle-release-current.png'
& $qaAdb -P 5038 -s emulator-5556 shell screencap -p /data/local/tmp/doodle-release-current.png
& $qaAdb -P 5038 -s emulator-5556 pull /data/local/tmp/doodle-release-current.png $qaLocalPath
```

Keep temporary XML/screenshots in `/data/local/tmp`. Putting QA screenshots in shared Pictures or `/sdcard` made them appear in the photo picker. Place only the approved photo-test input in Pictures when needed. Remove only owned disposable files after saving minimal final evidence; leave active process logs and shared files alone. Headless emulator testing can use the Android SDK even when desktop window-control tools cannot see a native window.

## Validate the actual Play-installed candidate

1. Run the native/backend tests, typechecks, relevant integration/browser checks and release build required by the changed code. Use real Redis for purchase ledger changes and independent review before release. Do not infer approval to delegate from the review requirement.
2. Inspect actual phone-size, font scaling, languages and transient UI states. Fixture UI captures prove presentation only. Check four free drawings, the fourth result's Get more, preserved prompt/result, selected pack, unavailable prices, disabled processing CTA, cancellation and automatic verified return.
3. Use Google license-test instruments for every pack. Verify the checkout actually says it is a test order with no charge. Cancel if a real payment method is offered. Record displayed price, selected product, starting balance, actual server grant and consumption; test repurchase, decline, cancellation, pending completion/cancellation, controlled interruption and cold recovery. Confirm pending payments grant nothing until purchased, and duplicate verification/recovery never grants twice. Keep legacy ten-credit recovery and offer-boundary promises covered.
4. Exercise refund reconciliation against the actual test order. Verify the recorded grant is reversed subject to spent-credit/active-hold safeguards, repeat reconciliation is idempotent, and residual review is clear or explained. Check the deployed daily 03:00 UTC reconciliation and latest heartbeat `doodle:play:voids:reconciliation`. A successful manual run does not prove a future scheduled invocation. [Scheduler evidence and operator tooling](play-refund-scheduler-qa.md), [reconciliation CLI](../scripts/reconcile-play-voids.mts).
5. Test fresh native sign-in and real text/photo generation with an approved provider budget. Preserve request IDs, result captures and balance changes. Check upload timing and system picker behavior. Use [generation cost reference](generation-costs.md); record estimated usage separately from conservative reserved budget. Existing release approval does not authorize spending on a future release.

For each check record the build, installation source, accounts' roles, normal or test Integrity verdict scope, actual outcome and remaining limits. Distinguish source review, simulated tests, fixture screenshots, production web requests, Play-installed emulator integration and owner-reported physical-phone evidence. Never backfill an unobserved check from an older release.

## Submit and verify availability

Obtain the applicable owner approval, review the rendered store text and privacy/Data safety mapping against all distributed versions, and promote the exact tested artifact. Re-read the pending change list before sending it for review, including rollout percentage, countries and managed publishing. Keep compatible backend fulfillment and recovery available if new checkout is disabled.

Save the Console submission readback and quick-check result in the dated record. Submitted, in review, available to internal testers and public are different states. Confirm actual public availability before announcing launch or shifting dates. For this launch, apply total delay beyond 12 October once to launch, report and bonus expiry together; do not shift from submission time. Verify purchase/refund health after availability. Channel reporting uses Play completed acquisitions only, without attributing purchases or revenue to channels.

## Evidence and official references

- [10 October account mismatch and resolution](qa/combined-release-2026-10-10/integrity-investigation.json)
- [Actual code 12 sign-in, text and photo results](qa/combined-release-2026-10-10/play-v12-generation-validation.json)
- [Play payment validation](qa/combined-release-2026-10-10/play-installed-validation.json)
- [Production submission readback](qa/combined-release-2026-10-10/play-production-submission.json)
- [Prior physical-phone evidence with limitations](physical-phone-qa.json)

Official references checked 10 October 2026: [Integrity test responses](https://developer.android.com/google/play/integrity/additional-tools), [Integrity setup](https://developer.android.com/google/play/integrity/setup), [license-test payments](https://developer.android.com/google/play/billing/test). Recheck current requirements when a later release changes the integration or encounters a new store gate.
