import { useEffect } from "react";
import { Tabs } from "expo-router/js-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F } from "@/lib/theme";
import { setupNotifications, useAssignmentAlerts } from "@/lib/notifications";
import { useMe } from "@/lib/useMe";

export default function MarshalTabs() {
  const { me, mine } = useMe();
  useEffect(() => { setupNotifications(); }, []);
  useAssignmentAlerts(mine, me?.id); // buzz on a new Dispatcher instruction, whichever tab is open

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 13 },
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line },
        sceneStyle: { backgroundColor: C.ground },
      }}>
      <Tabs.Screen name="zone" options={{ title: "My zone", tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color as string} /> }} />
      <Tabs.Screen name="map" options={{ title: "Map", tabBarIcon: ({ color }) => <Feather name="map" size={24} color={color as string} /> }} />
      <Tabs.Screen name="rights" options={{ title: "Rights", tabBarIcon: ({ color }) => <MaterialCommunityIcons name="scale-balance" size={25} color={color as string} /> }} />
    </Tabs>
  );
}
