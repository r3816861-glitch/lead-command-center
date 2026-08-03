import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Obsidian glassmorphism root: deep near-black background so the app's
// dark mode blends seamlessly with the system status bar, and light
// mode still gets a controlled base before index.jsx takes over.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent={true} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0A0E1A" },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
