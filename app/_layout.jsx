import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// Single-screen app on purpose: everything lives inside app/index.jsx as
// internal tab state + modals (not separate routes). This means there is
// nothing for expo-router to mis-navigate — it always lands on index.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
