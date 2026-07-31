import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Single-screen app on purpose: everything lives inside app/index.jsx as
// internal tab state + modals (not separate routes). This means there is
// nothing for expo-router to mis-navigate — it always lands on index.
// SafeAreaProvider is required so index.jsx can use useSafeAreaInsets for
// proper top padding under the system status bar.
// StatusBar is translucent so the header blends into the top system bar for
// a full-screen native feel. The index screen controls light/dark style
// dynamically via its own <StatusBar> based on the theme toggle.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent={true} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
