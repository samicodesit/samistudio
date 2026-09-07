# Local Android toolchain

Verified September 7, 2026 in Ubuntu WSL. The free tooling is isolated at `/home/mests/.local/share/doodle-android-tools`; app dependencies and system Java/PATH were not changed. This prepares Android builds; it does not create a package, signing key, APK, AAB, or Play release.

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

The next project step is to settle the package identifier and Android-specific billing experience, then generate the wrapper in a dedicated directory using the deployed manifest. Bubblewrap `init` asks signing questions; release-key creation and domain association need their own deliberate setup. No physical-device/emulator test has run, and no emulator image was installed.
