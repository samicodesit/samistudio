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
  "./plugins/withDoodleReleaseSigning",
  "expo-dev-client",
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
  ["expo-media-library", { granularPermissions: ["photo"], isAccessMediaLocationEnabled: false }],
  "expo-secure-store",
  "expo-splash-screen",
  "expo-iap",
  [
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: 36,
        targetSdkVersion: 36,
      },
    },
  ],
];

if (iosGoogleUrlScheme) {
  plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: iosGoogleUrlScheme }]);
}

const config: NativeExpoConfig = {
  name: "Doodle",
  slug: "doodle",
  version: "0.1.1",
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
    versionCode: 3,
    // Doodle creates its own PNG and never reads the user's gallery or draws
    // over other apps. Keep legacy storage support for Android <= 12, while
    // preventing modern gallery and overlay permissions from entering the
    // release manifest through Expo or transitive libraries.
    blockedPermissions: [
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
    adaptiveIcon: {
      // The approved asset is a complete opaque composition. Keep it as the
      // foreground and do not layer a second background tile beneath it.
      foregroundImage: brandAdaptiveIcon,
      backgroundColor: "#eef1ea",
    },
  },
  ios: {
    bundleIdentifier: packageName,
    supportsTablet: true,
  },
  plugins,
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://doodle.samistudio.nl",
    googleWebClientId,
    integrityCloudProjectNumber,
    nativeFixtureMode: process.env.EXPO_PUBLIC_NATIVE_FIXTURE_MODE === "true",
  },
};

export default config;
