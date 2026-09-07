# Doodle Android debug shell

This is a local device-QA TWA project generated with Bubblewrap 1.25.0 from the deployed Doodle manifest. Package: `nl.samistudio.doodle`; launch URL: `https://doodle.samistudio.nl/`; target and compile API: 36; minimum API: 23 (required by the billing adapter).

It is **not ready for Google Play distribution**. The hosted app still uses Stripe, and the Play catalog, purchase-token verification, credit fulfillment, refund reconciliation, release signing and domain association are not complete. Including the Play Billing adapter does not implement those flows.

No production Digital Asset Links file was deployed. An ordinary debug installation should therefore fall back to a browser Custom Tab with browser UI until a deliberately configured test association exists. This still permits device QA of login, generation, sharing, offline navigation and account deletion.

## Build and install locally

Use the environment from `../docs/android-toolchain.md`, then from this directory:

```bash
./gradlew --no-daemon --console=plain :app:assembleDebug
./gradlew --no-daemon --console=plain :app:dependencies --configuration debugRuntimeClasspath
# Only after connecting and authorizing a QA device:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Gradle creates its conventional local debug key when necessary. Build outputs, keystores and machine configuration are ignored. No release keystore is configured; do not upload the debug artifact to Play or use Bubblewrap's signing flow without separate release setup.

## Configuration and maintenance

`twa-manifest.json` records source manifest and Bubblewrap settings. The Play Billing adapter is enabled (`com.google.androidbrowserhelper:billing:1.2.0`), whose published POM requests Play Billing 8.3.0. Notification and location delegation are off; the trusted delegation service stays enabled for Digital Goods requests. No extra app runtime permissions are requested for camera, microphone or location.

The generated project uses Maven Central instead of JCenter, enables the trusted delegation service independently of notifications, pins the Gradle distribution checksum, sets minimum API 23 and removes the deprecated manifest package attribute (Gradle provides the namespace). Regeneration must preserve these changes. The source Android project is authoritative for this debug build; no release key or fingerprint is stored in `twa-manifest.json`.

The APK must still be exercised on a real Android device. Never test account deletion against a real account unless that deletion is explicitly intended.

## Build evidence (September 7, 2026)

`assembleDebug` and the debug runtime dependency report passed. The graph resolves `com.android.billingclient:billing:8.3.0`. APK metadata confirms package `nl.samistudio.doodle`, minimum API 23, target/compile API 36 and a debuggable launcher. Requested permissions are billing, network state, Internet and the AndroidX signature-level internal receiver permission; no camera, microphone, location or notification permission is present.

Artifact: `app/build/outputs/apk/debug/app-debug.apk` (5.6 MiB), SHA-256 `ad86d299cc13ebd2bfdf57f5ab2ee410bace7b416cda39af53eab5071a5238d1`. It is signed with the local Android debug certificate. No device installation or Play upload was performed.
