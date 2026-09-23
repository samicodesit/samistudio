import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DoodleAppView } from "./src/ui";
import { NATIVE_FONT_ASSETS } from "./src/platform/fonts";
import { useNativeDoodleApp } from "./src/app/use-native-doodle-app";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded, fontError] = useFonts(NATIVE_FONT_ASSETS);
  const props = useNativeDoodleApp();
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontError, fontsLoaded]);
  if (fontError) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.startupError}>
          <Text style={styles.startupErrorTitle}>Doodle</Text>
          <Text style={styles.startupErrorBody}>The app could not load its fonts. Please restart Doodle.</Text>
        </View>
      </SafeAreaProvider>
    );
  }
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <DoodleAppView {...props} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  startupError: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#eef1ea" },
  startupErrorTitle: { color: "#1f3028", fontSize: 32, fontWeight: "700", marginBottom: 12 },
  startupErrorBody: { color: "#425149", fontSize: 16, lineHeight: 24, textAlign: "center" },
});
