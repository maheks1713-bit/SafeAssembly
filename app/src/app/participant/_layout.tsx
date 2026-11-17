import { Tabs } from "expo-router/js-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F } from "@/lib/theme";

export default function ParticipantTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line },
        sceneStyle: { backgroundColor: C.ground },
      }}>
      <Tabs.Screen name="event" options={{ title: "Event", tabBarIcon: ({ color }) => <Feather name="map" size={23} color={color as string} /> }} />
      <Tabs.Screen name="news" options={{ title: "Updates", tabBarIcon: ({ color }) => <Feather name="bell" size={23} color={color as string} /> }} />
      <Tabs.Screen name="help" options={{ title: "Help", tabBarIcon: ({ color }) => <Feather name="heart" size={23} color={color as string} /> }} />
      <Tabs.Screen name="rights" options={{ title: "Rights", tabBarIcon: ({ color }) => <MaterialCommunityIcons name="scale-balance" size={24} color={color as string} /> }} />
    </Tabs>
  );
}
