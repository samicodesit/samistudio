import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plist = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", resolve(root, "ios/Doodle/Info.plist")], { encoding: "utf8" }));
const delegate = readFileSync(resolve(root, "ios/Doodle/AppDelegate.swift"), "utf8");
const properties = JSON.parse(readFileSync(resolve(root, "ios/Podfile.properties.json"), "utf8"));
const project = readFileSync(resolve(root, "ios/Doodle.xcodeproj/project.pbxproj"), "utf8");
const entitlements = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", resolve(root, "ios/Doodle/Doodle.entitlements")], { encoding: "utf8" }));
const errors = [];
const scenes = plist.UIApplicationSceneManifest?.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
if (!Array.isArray(scenes) || !scenes.some(scene => scene.UISceneDelegateClassName === "EXExpoAppSceneDelegate")) {
  errors.push("iOS 27 launch requires Expo's scene lifecycle manifest. Enable ios.enableSceneSupport and regenerate the project.");
}
if (!delegate.includes("ExpoReactNativeFactoryProvider") || delegate.includes("factory.startReactNative(")) {
  errors.push("The AppDelegate must provide the React Native factory to the scene delegate instead of starting the legacy window.");
}
if (properties["ios.deploymentTarget"] !== "16.4") errors.push("The installed Expo SDK requires the configured iOS 16.4 floor.");
const deviceFamilies = [...project.matchAll(/TARGETED_DEVICE_FAMILY\s*=\s*"?([^";]+)"?;/g)].map(match => match[1].trim());
if (!deviceFamilies.length || deviceFamilies.some(value => value !== "1")) errors.push("This release must target iPhone only.");
const allowedPurposes = new Set(["NSPhotoLibraryAddUsageDescription", "NSLocalNetworkUsageDescription"]);
for (const key of Object.keys(plist)) {
  if (key.endsWith("UsageDescription") && !allowedPurposes.has(key)) errors.push(`Unexpected permission declaration: ${key}`);
}
if (!plist.NSPhotoLibraryAddUsageDescription) errors.push("Saving doodles requires a specific add-to-Photos purpose string.");
if (!entitlements["com.apple.developer.applesignin"]?.includes("Default")) errors.push("Apple sign-in requires its native entitlement.");
const expectedAttestEnvironment = process.env.DOODLE_APP_ATTEST_ENVIRONMENT?.trim() || "production";
if (!["production", "development"].includes(expectedAttestEnvironment) || entitlements["com.apple.developer.devicecheck.appattest-environment"] !== expectedAttestEnvironment) errors.push("App Attest must match the selected environment. Distribution defaults to production.");
if (plist.CFBundleAllowMixedLocalizations !== true) errors.push("The Apple sign-in button must use the device locale.");
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log("iOS project preflight passed: scene lifecycle, iPhone scope, deployment floor, save-only permissions, Apple sign-in and App Attest.");
