import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { C } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({ SpaceGrotesk_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = loaded || Boolean(error); // never block the demo on a font download

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.ground } }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: C.deepTeal } }} />
        <Stack.Screen name="injector" options={{ contentStyle: { backgroundColor: C.night }, animation: "slide_from_bottom" }} />
        <Stack.Screen name="organizer" />
        <Stack.Screen name="marshal" />
        <Stack.Screen name="participant" />
        <Stack.Screen name="report" />
      </Stack>
    </>
  );
}
