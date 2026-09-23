import { Platform } from "react-native";

const RUNTIME_FONT_ASSETS = {
  BricolageGrotesque: require("../../assets/BricolageGrotesque-SemiBold.ttf"),
  IBMPlexSans: require("../../assets/IBMPlexSans-Regular.ttf"),
  Alexandria: require("../../assets/Alexandria-Regular.ttf"),
} as const;

// Android registers these family names as weighted XML resources through the
// expo-font config plugin. Do not load a single variable file at runtime and
// overwrite that family mapping. iOS and web still load the bundled static
// files under the same aliases for the shared UI code.
export const NATIVE_FONT_ASSETS = Platform.OS === "android" ? {} : RUNTIME_FONT_ASSETS;
