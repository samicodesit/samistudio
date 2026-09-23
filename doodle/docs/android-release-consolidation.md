# Android release consolidation

Updated September 23, 2026.

`mobile/` is the canonical Android source for Google Play. Its Expo and
Gradle metadata are aligned with the current Play Closed testing Alpha
release, release 3: version `0.1.1`, versionCode `3`, package
`nl.samistudio.doodle`, and target API 36. This is a closed testing release,
not a Production release. The locally generated release AAB matches the
preserved v3 artifact used for the current release.

`android/` is the historical Bubblewrap Trusted Web Activity project. It is
kept for QA and release provenance, but it uses the same package with version
`0.1.0` and versionCode `1`. Do not rebuild or upload it as a production
update. The next Play upload from `mobile/` must use a versionCode greater
than 3.

The web deployment remains separate. The root `.vercelignore` excludes both
native projects, native build directories, package installations, and local
APK, AAB, and TGZ artifacts. Public web assets and Next.js routes remain
outside those exclusions.

The current `mobile/android/app/src/main/res/values/strings.xml` contains
`expo_runtime_version` value `0.1.1`, matching the app-version source:
`mobile/app.config.ts` declares version `0.1.1` and uses the `appVersion`
runtime policy. This file is generated native output. Do not hand-edit this
generated value. Before the next native build, run
`npx expo prebuild --clean --no-install --platform android` from `mobile/`
after reviewing the generated diff. This regenerates the Android project from
the Expo config and config plugins, including the runtime resource.

Before a production Play release, recheck the live Console state and confirm
the closed-test requirement, production access, certified-device Play
Integrity and generation, a license-test purchase and refund path, and the
scheduled void-reconciliation or Real-time Developer Notifications process.
Resolve the current Play warnings for edge-to-edge behavior and large-screen
resizability or orientation before production submission.
