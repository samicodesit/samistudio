# Android 0.1.9 build 14

Version 14 was submitted for production rollout to all existing targeted countries at 100%. Console shows **Changes in review**, with managed publishing off. The final readback still shows automated quick checks running. Public availability is not yet confirmed; version 13 was the last verified public release. See [status.json](status.json) and play-production-in-review.png.

The exact signed internal-track AAB was promoted without rebuilding. Source commit `2adfae6` and the artifact SHA256 are recorded in status.json. Fresh native verification passed: 29 files, 276 tests, TypeScript, bundleRelease, lintRelease, bundle validation, signature and 16 KB alignment. Earlier actual Android and iOS layout checks are in [detail QA](../detail-selector-2026-10-21/report.md).

The local official Google Play emulator updated to version 14 (0.1.9), installer `com.android.vending`. Its Play signing certificate matches the existing backend allowlist. Fresh Doodle Google sign-in succeeded as the existing reviewer. Medium was selected on the first launch. Simple and Pink persisted through a cold launch. The actual composer, seven-color row and three-example drawer were visually inspected. The composer retains its existing size.

Two real native generations succeeded through the unchanged production Integrity guard and existing reviewer test responses: Pink/Medium text, then White/Detailed photo using the previously approved pet input. Both results passed visual inspection. The balance moved 229 to 228 to 227. This proves the configured emulator integration, not normal physical-device attestation. Result captures are play14-text-result.png and play14-photo-result.png.

Billing smoke loaded all three localized pack prices, selected Mini and opened Google Play checkout. Back cancelled Google's immediate-performance consent without accepting new purchase terms or creating an order, and returned cleanly to the paywall and composer. No real purchase occurred. Full payment/refund regression was not repeated because the owner requested a focused, lean release of the UI changes.

Seven earlier current-source provider probes validated all seven paper presets, with estimated token cost USD 0.119127. These are separate from the two native end-to-end requests. EUR 0.40 was conservatively reserved for those two native calls, whose usage tokens were not collected from the UI. No generation retries occurred, and spending stayed within the approved EUR 1 cap.

The owner explicitly approved the additional SDK license and Google/Google Play Terms. Existing reviewer credentials and SMS verification were used with authorization. No credentials are stored in this record. The existing reviewer list was enabled for the internal test and the reviewer accepted its invitation. Play track propagation completed after a normal emulator restart with data preserved. No production security checks or test-verdict settings were weakened.
