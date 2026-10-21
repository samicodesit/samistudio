import type { ExpoConfig } from "expo/config";

type NativeExpoConfig = Omit<ExpoConfig, "android"> & {
  splash?: { image: string; resizeMode: "contain"; backgroundColor: string };
  android?: NonNullable<ExpoConfig["android"]> & { blockedPermissions?: string[] };
};

const packageName = "nl.samistudio.doodle";
const brandIcon = "./assets/doodle-icon.png";
const brandSplash = "./assets/doodle-splash.png";
const brandAdaptiveIcon = "./assets/doodle-adaptive-icon-maskable.png";
const defaultGoogleWebClientId = "368967912119-eg869v0671g2kvg215l1ru91n1p1ihsn.apps.googleusercontent.com";
const defaultIntegrityCloudProjectNumber = "368967912119";
const iosGoogleUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
const iosGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const appleTeamId = process.env.DOODLE_APPLE_TEAM_ID?.trim();
const iosBuildVariant = process.env.DOODLE_IOS_BUILD_VARIANT?.trim() || "production";
if (iosBuildVariant !== "production" && iosBuildVariant !== "fixture") {
  throw new Error("DOODLE_IOS_BUILD_VARIANT must be production or fixture");
}
const iosFixture = iosBuildVariant === "fixture";
const appAttestEnvironment = process.env.DOODLE_APP_ATTEST_ENVIRONMENT?.trim() || "production";
if (appAttestEnvironment !== "production" && appAttestEnvironment !== "development") {
  throw new Error("DOODLE_APP_ATTEST_ENVIRONMENT must be production or development");
}
if (appleTeamId && !/^[A-Z0-9]{10}$/.test(appleTeamId)) {
  throw new Error("DOODLE_APPLE_TEAM_ID must be a 10-character Apple team ID");
}
if (iosGoogleClientId && !/^\d+-[^\s]+\.apps\.googleusercontent\.com$/.test(iosGoogleClientId)) {
  throw new Error("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be an iOS OAuth client ID");
}
if (iosGoogleClientId && iosGoogleUrlScheme && iosGoogleUrlScheme !== `com.googleusercontent.apps.${iosGoogleClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`) {
  throw new Error("Google iOS client ID and URL scheme must match");
}
const resolvedIosGoogleUrlScheme = iosGoogleUrlScheme || (iosGoogleClientId
  ? `com.googleusercontent.apps.${iosGoogleClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : undefined);

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || defaultGoogleWebClientId;
const integrityCloudProjectNumber = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER?.trim() || defaultIntegrityCloudProjectNumber;

if (!/^\d+-[^\s]+\.apps\.googleusercontent\.com$/.test(googleWebClientId)) {
  throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be a Google OAuth web client ID");
}
if (!/^\d+$/.test(integrityCloudProjectNumber)) {
  throw new Error("EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER must be numeric");
}

const plugins: NonNullable<ExpoConfig["plugins"]> = [
  "./plugins/withDoodleLocalBuildTypes",
  "./plugins/withDoodleSharedBundleInputs",
  "./plugins/withDoodleConfigurationChanges",
  "./plugins/withDoodleReleaseSigning",
  "expo-dev-client",
  "expo-asset",
  "expo-image",
  "expo-localization",
  "expo-apple-authentication",
  "expo-sharing",
  ["expo-image-picker", { cameraPermission: false, microphonePermission: false, photosPermission: false }],
  [
    "expo-font",
    {
      android: {
        fonts: [
          {
            fontFamily: "BricolageGrotesque",
            fontDefinitions: [
              { path: "./assets/BricolageGrotesque-Regular.ttf", weight: 400 },
              { path: "./assets/BricolageGrotesque-SemiBold.ttf", weight: 600 },
              { path: "./assets/BricolageGrotesque-Bold.ttf", weight: 700 },
            ],
          },
          {
            fontFamily: "IBMPlexSans",
            fontDefinitions: [
              { path: "./assets/IBMPlexSans-Regular.ttf", weight: 400 },
              { path: "./assets/IBMPlexSans-SemiBold.ttf", weight: 600 },
              { path: "./assets/IBMPlexSans-Bold.ttf", weight: 700 },
            ],
          },
          {
            fontFamily: "Alexandria",
            fontDefinitions: [
              { path: "./assets/Alexandria-Regular.ttf", weight: 400 },
              { path: "./assets/Alexandria-SemiBold.ttf", weight: 600 },
              { path: "./assets/Alexandria-Bold.ttf", weight: 700 },
            ],
          },
        ],
      },
      ios: {
        fonts: [
          "./assets/BricolageGrotesque-Regular.ttf",
          "./assets/BricolageGrotesque-SemiBold.ttf",
          "./assets/BricolageGrotesque-Bold.ttf",
          "./assets/IBMPlexSans-Regular.ttf",
          "./assets/IBMPlexSans-SemiBold.ttf",
          "./assets/IBMPlexSans-Bold.ttf",
          "./assets/Alexandria-Regular.ttf",
          "./assets/Alexandria-SemiBold.ttf",
          "./assets/Alexandria-Bold.ttf",
        ],
      },
    },
  ],
  ["expo-media-library", {
    granularPermissions: ["photo"],
    isAccessMediaLocationEnabled: false,
    photosPermission: false,
    savePhotosPermission: "Save the doodle you create to your photo library when you tap Save.",
  }],
  ["expo-secure-store", { faceIDPermission: false }],
  "expo-splash-screen",
  "expo-iap",
  [
    "expo-build-properties",
    {
      ios: {
        enableSceneSupport: true,
      },
      android: {
        compileSdkVersion: 36,
        targetSdkVersion: 36,
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    },
  ],
];

if (resolvedIosGoogleUrlScheme) {
  plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: resolvedIosGoogleUrlScheme }]);
}

const config: NativeExpoConfig = {
  name: "Doodle",
  slug: "doodle",
  version: "0.1.8",
  icon: brandIcon,
  orientation: "portrait",
  splash: {
    image: brandSplash,
    resizeMode: "contain",
    backgroundColor: "#eef1ea",
  },
  userInterfaceStyle: "light",
  scheme: "doodle",
  platforms: ["android", "ios"],
  runtimeVersion: { policy: "appVersion" },
  android: {
    package: packageName,
    versionCode: 13,
    // Doodle uses the system picker for access to one selected photo. Keep
    // legacy save support for Android <= 12, while
    // preventing modern gallery and overlay permissions from entering the
    // release manifest through Expo or transitive libraries.
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
    adaptiveIcon: {
      // The approved asset is a complete opaque composition. Keep it as the
      // foreground and do not layer a second background tile beneath it.
      foregroundImage: brandAdaptiveIcon,
      backgroundColor: "#ffeb8a",
    },
  },
  ios: {
    bundleIdentifier: iosFixture ? `${packageName}.fixture` : packageName,
    buildNumber: "5",
    deploymentTarget: "16.4",
    supportsTablet: false,
    usesAppleSignIn: true,
    entitlements: {
      "com.apple.developer.devicecheck.appattest-environment": appAttestEnvironment,
    },
    ...(appleTeamId ? { appleTeamId } : {}),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(iosFixture ? { CFBundleDisplayName: "Doodle QA" } : {}),
    },
  },
  plugins,
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://doodle.samistudio.nl",
    googleWebClientId,
    googleIosClientId: iosGoogleClientId || null,
    integrityCloudProjectNumber,
    nativeFixtureMode: iosFixture || process.env.EXPO_PUBLIC_NATIVE_FIXTURE_MODE === "true",
  },
};

export default config;
