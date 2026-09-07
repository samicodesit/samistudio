# Doodle Android debug shell

This is a local device-QA TWA project generated with Bubblewrap 1.25.0 from the deployed Doodle manifest. Package: `nl.samistudio.doodle`; launch URL: `https://doodle.samistudio.nl/?runtime=play`; target and compile API: 36; minimum API: 23 (required by the billing adapter).

It is **not ready for Google Play distribution**. The web purchase flow, server token verification and atomic credit fulfillment are implemented behind disabled Play configuration. The Play catalog, real test transactions and domain association remain incomplete.

No production Digital Asset Links file was deployed. An ordinary debug installation should therefore fall back to a browser Custom Tab with browser UI until a deliberately configured test association exists. This still permits device QA of login, generation, sharing, offline navigation and account deletion.

## Build and install locally

Use the environment from `../docs/android-toolchain.md`, then from this directory:

```bash
./gradlew --no-daemon --console=plain :app:assembleDebug
./gradlew --no-daemon --console=plain :app:dependencies --configuration debugRuntimeClasspath
# Only after connecting and authorizing a QA device:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Gradle creates its conventional local debug key when necessary. Build outputs, keystores and machine configuration are ignored. Release signing is configured separately below; never upload the debug artifact to Play.

## Configuration and maintenance

`twa-manifest.json` records source manifest and Bubblewrap settings. The local `billing` module preserves AndroidBrowserHelper billing 1.2.0 with a narrow account-binding patch; see `billing/README.md`. It resolves Play Billing 8.3.0. Notification and location delegation are off; the trusted delegation service stays enabled for Digital Goods requests. No extra app runtime permissions are requested for camera, microphone or location.

The generated project uses Maven Central instead of JCenter, enables the trusted delegation service independently of notifications, pins the Gradle distribution checksum, sets minimum API 23 and removes the deprecated manifest package attribute (Gradle provides the namespace). Regeneration must preserve these changes. The source Android project is authoritative for this debug build; no release key or fingerprint is stored in `twa-manifest.json`.

The APK must still be exercised on a real Android device. Never test account deletion against a real account unless that deletion is explicitly intended.

## Build evidence (September 7, 2026)

`assembleDebug` and the debug runtime dependency report passed. The graph resolves `com.android.billingclient:billing:8.3.0`. APK metadata confirms package `nl.samistudio.doodle`, minimum API 23, target/compile API 36 and a debuggable launcher. Requested permissions are billing, network state, Internet and the AndroidX signature-level internal receiver permission; no camera, microphone, location or notification permission is present.

Artifact: `app/build/outputs/apk/debug/app-debug.apk` (9,935,582 bytes), SHA-256 `9fdafce6d47b93c6d0ffe958346ab535f8ca395cfe67a15c26ae6a57ecc84d64`. It is signed with the local Android debug certificate. No device installation or Play upload was performed.

## Release signing

Release signing is enabled only when all four environment variables below are present. A partial configuration fails the Gradle build, and a release without them stays unsigned; the debug key is never used for release signing.

```bash
export DOODLE_UPLOAD_STORE_FILE=/absolute/path/to/doodle-upload.jks
export DOODLE_UPLOAD_STORE_PASSWORD='secret'
export DOODLE_UPLOAD_KEY_ALIAS=doodle-upload
export DOODLE_UPLOAD_KEY_PASSWORD='secret'
./gradlew --no-daemon --console=plain :app:bundleRelease
```

Keep the upload keystore and password file outside the repository and back them up securely. Google Play App Signing uses this upload certificate to authenticate submitted bundles; the eventual Play app-signing certificate is separate and is the certificate required by production Digital Asset Links.

The local upload certificate is exported at `/home/mests/.local/share/doodle-android-tools/doodle-upload-certificate.pem`. Its public fingerprints and the current signed bundle hash are recorded after the release build below.

## Signed release bundle

The September 7, 2026 signed release build passed R8 and Gradle's `validateSigningRelease` and `signReleaseBundle` tasks. `jarsigner -verify` reports `jar verified`; it also reports the expected self-signed certificate and absent timestamp warnings for the upload key, plus JAR stream consistency warnings for the Android App Bundle ZIP layout.

- Artifact: `app/build/outputs/bundle/release/app-release.aab` (1,787,917 bytes)
- Preserved upload copy: `/home/mests/.local/share/doodle-android-tools/releases/doodle-0.1.0-v1-upload-signed.aab`
- Artifact SHA-256: `f7addf03b0e51394312e7c30a9b4d586a55205ea37a080c929d7f563f09314f5`
- Upload certificate: RSA 2048, SHA256withRSA, valid September 7, 2026 through January 23, 2054
- Upload certificate SHA-1: `44:D6:07:FE:0D:B6:BC:19:9E:12:6A:51:F8:CE:A0:64:62:3E:45:54`
- Upload certificate SHA-256: `CA:AA:B7:44:11:C3:7B:97:DD:3D:AA:3F:47:35:94:CD:D6:6C:DC:CB:E0:AF:6D:EB:AE:C5:03:CE:0C:34:BC:C1`

The private keystore is `/home/mests/.local/share/doodle-android-tools/release-signing/doodle-upload.jks`; its password environment file is `/home/mests/.local/share/doodle-android-tools/release-signing/release-signing.env`. Both have mode `600` inside a mode `700` directory and must be backed up together without exposing their contents. The public certificate is `/home/mests/.local/share/doodle-android-tools/doodle-upload-certificate.pem`.

No bundle has been uploaded and no production Digital Asset Links file has been deployed. The upload fingerprint above is not the future Play app-signing fingerprint used for that association.
