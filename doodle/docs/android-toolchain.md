# Local Android toolchain

Verified September 7, 2026 in Ubuntu WSL. The free tooling is isolated at `/home/mests/.local/share/doodle-android-tools`; web-app dependencies and system Java/PATH were not changed. The debug wrapper is documented in `../android/README.md`. A local upload signing key and signed release bundle now exist; see that README for public fingerprints and build evidence. No bundle has been uploaded to Google Play.

| Tool | Verified version |
| --- | --- |
| Node used for Bubblewrap | 22.17.1 |
| Bubblewrap CLI | 1.25.0 |
| Eclipse Temurin JDK | 17.0.20.1+1 |
| Android command-line tools | 22.0 (download 15859902) |
| Android platform | API 36, revision 2 |
| Android build tools | 36.1.0 |
| Android platform tools / adb | 37.0.1 / 1.0.41 |

## Use in WSL

```bash
export DOODLE_ANDROID_TOOLS=/home/mests/.local/share/doodle-android-tools
export JAVA_HOME="$DOODLE_ANDROID_TOOLS/jdk-17.0.20.1+1"
export ANDROID_HOME="$DOODLE_ANDROID_TOOLS/android-sdk"
export PATH="/home/mests/.nvm/versions/node/v22.17.1/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

node "$DOODLE_ANDROID_TOOLS/node_modules/@bubblewrap/cli/bin/bubblewrap.js" \
  --version --config="$DOODLE_ANDROID_TOOLS/bubblewrap-config.json"
java -version
adb version
"$ANDROID_HOME/bin/sdkmanager" --sdk_root="$ANDROID_HOME" --list_installed
```

Bubblewrap's isolated JSON config points to these JDK/SDK paths. SDK `bin` and `lib` symlinks point to `cmdline-tools/22.0` so Bubblewrap's SDK path checks and build-tool installer work without duplicating SDK packages. Current `sdkmanager` works but emits a deprecation notice recommending `android sdk`; see the [Android CLI documentation](https://developer.android.com/tools/agents/android-cli).

Bubblewrap 1.25.0's `doctor` CLI ignores `--config` when dispatching its second configuration load. The equivalent doctor implementation passed with the isolated config:

```bash
node - <<'NODE'
const base = '/home/mests/.local/share/doodle-android-tools';
const { doctor } = require(`${base}/node_modules/@bubblewrap/cli/dist/lib/cmds/doctor`);
doctor(undefined, `${base}/bubblewrap-config.json`).then(ok => {
  process.exitCode = ok ? 0 : 1;
});
NODE
```

## Provenance and setup

Bubblewrap was installed with `npm install --prefix /home/mests/.local/share/doodle-android-tools --no-audit --no-fund @bubblewrap/cli@1.25.0`.

The portable JDK came from the official [Temurin release](https://github.com/adoptium/temurin17-binaries/releases/tag/jdk-17.0.20.1%2B1). Its SHA-256 matched the release checksum: `3808d1d15e3ec6bd5b84057fb5d84c33d8a1536a258146bcea2e603fc726e08e`.

Linux command-line tools came from the official [Android downloads page](https://developer.android.com/studio): `commandlinetools-linux-15859902_latest.zip`, SHA-256 `4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583`. The archive was checked before extraction. Download URLs and checksums are also saved in the isolated directory's `download-checksums.json`.

The required free Android SDK terms were reviewed and accepted for the authorized Android build. The package installer displayed `android-sdk-license`, dated January 16, 2019; the download page's current SDK terms were also reviewed. No optional telemetry consent was given. Only these additional packages were installed:

```bash
"$ANDROID_HOME/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  --install 'platform-tools' 'platforms;android-36' 'build-tools;36.1.0'
```

The local wrapper uses `nl.samistudio.doodle` and was generated through Bubblewrap's core API to avoid release-signing prompts. Its Gradle plugin also installed default build tools 35.0.0. The local upload signing key and signed bundle are documented in `../android/README.md`. Production domain association, Play catalog setup and real billing transactions remain release work. No physical-device/emulator UI test has passed; the native Windows emulator download below is in progress.

## Windows Android preview (setup in progress)

On September 7, 2026, Ubuntu WSL had no `/dev/kvm`, so its Linux emulator could not use KVM. A read-only native Windows `WHvGetCapability(WHvCapabilityCodeHypervisorPresent)` call returned success and `1`. This is a promising prerequisite, **not a successful Android Emulator acceleration check or boot**. No Windows virtualization feature, driver or firmware setting was changed, and no reboot was requested.

Free native Windows packages are downloading to `C:\Users\Sami\.codex\doodle-android-preview\sdk` using the existing isolated SDK manager with `REPO_OS_OVERRIDE=windows`: `emulator`, `platform-tools`, and `system-images;android-36;google_apis;x86_64`. The official emulator archive is `emulator-windows_x64-15917651.zip` (441,926,448 bytes).

The installer reuses the already accepted SDK license. Progress is in WSL `/tmp/doodle-emulator-install.log`. Downloading is slow (roughly 0.3 MB/s in direct checks); installation, acceleration and boot remain unverified. This Google APIs image is for UI QA, not a substitute for Play Store billing tests.

A local launcher is prepared at `C:\Users\Sami\.codex\doodle-android-preview\start-preview.ps1`. Its PowerShell syntax and incomplete-installation guard were checked. Once installation completes, run from PowerShell:

```powershell
& "$env:USERPROFILE/.codex/doodle-android-preview/start-preview.ps1" -ShowWindow
```

The launcher checks installed packages and `emulator -accel-check`. It creates an isolated 1080 × 2400 API 36 virtual device, uses emulator port 5554 and native Windows adb port 5037, waits up to four minutes for Android boot, then installs and launches the existing debug APK. Omitting `-ShowWindow` runs headlessly. It does not configure production domain association. The debug shell should therefore show browser Custom Tab UI, as described in `../android/README.md`.

After an actual successful boot, useful commands are:

```powershell
$previewAdb = "$env:USERPROFILE/.codex/doodle-android-preview/sdk/platform-tools/adb.exe"
# Local dev server must also be reachable at Windows localhost:3100.
& $previewAdb -s emulator-5554 reverse tcp:3100 tcp:3100
& $previewAdb -s emulator-5554 shell am start -a android.intent.action.VIEW -d 'http://127.0.0.1:3100'
# Capture in Android, then pull the PNG without PowerShell binary redirection.
& $previewAdb -s emulator-5554 shell screencap -p /sdcard/doodle-preview.png
& $previewAdb -s emulator-5554 pull /sdcard/doodle-preview.png "$env:USERPROFILE/.codex/doodle-android-preview/doodle-preview.png"
```

Opening the local URL exercises the website in Android Chrome, not production TWA association or billing. Actual toolbar, Android Back, keyboard, and screenshot verification must be recorded after the emulator runs. No Android screen has been captured during this setup attempt.

Official references: [hardware acceleration](https://developer.android.com/studio/run/emulator-acceleration), [command-line emulator](https://developer.android.com/studio/run/emulator-commandline). The current command-line documentation marks `emulator` as deprecated in favor of `android emulator`; the launcher uses the still-documented executable shipped in the isolated SDK.
