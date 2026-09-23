import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gradleCommand = process.platform === "win32" ? "android\\gradlew.bat" : "android/gradlew";
const gradleArgs = [
  "-p",
  "android",
  ":app:assembleFixture",
  "--no-daemon",
  "-PreactNativeArchitectures=x86_64",
];

// The fixture package is safe only when its explicit runtime flag is embedded
// alongside the fixture application id. Set it here so a direct Gradle call
// cannot accidentally produce a live-runtime APK with a fixture package name.
const env = { ...process.env, EXPO_PUBLIC_NATIVE_FIXTURE_MODE: "true" };
if (process.platform === "linux") {
  const defaultJavaHome = "/home/mests/.local/share/doodle-android-tools/jdk-17.0.20.1+1";
  const defaultAndroidHome = "/home/mests/.local/share/doodle-android-tools/android-sdk";
  if (!env.JAVA_HOME && existsSync(defaultJavaHome)) env.JAVA_HOME = defaultJavaHome;
  if (!env.ANDROID_HOME && existsSync(defaultAndroidHome)) env.ANDROID_HOME = defaultAndroidHome;
  if (!env.ANDROID_SDK_ROOT && env.ANDROID_HOME) env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
}
const result = spawnSync(resolve(mobileRoot, gradleCommand), gradleArgs, {
  cwd: mobileRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Fixture build could not start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
