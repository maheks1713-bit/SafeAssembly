import { Tabs } from "expo-router/js-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F } from "@/lib/theme";
import { useTable } from "@/lib/store";

export default function OrganizerTabs() {
  const pending = useTable("drafts").filter((d) => d.status === "pending").length;
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
      <Tabs.Screen name="command" options={{ title: "Command", tabBarIcon: ({ color }) => <Feather name="map" size={23} color={color as string} /> }} />
      <Tabs.Screen name="agents" options={{ title: "Agents", tabBarIcon: ({ color }) => <Feather name="activity" size={23} color={color as string} /> }} />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approvals",
          tabBarIcon: ({ color }) => <Feather name="check-square" size={23} color={color as string} />,
          tabBarBadge: pending || undefined,
          tabBarBadgeStyle: { backgroundColor: C.critical, fontFamily: F.bold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="plan" options={{ title: "Plan", tabBarIcon: ({ color }) => <Feather name="clipboard" size={23} color={color as string} /> }} />
      <Tabs.Screen name="rights" options={{ title: "Rights", tabBarIcon: ({ color }) => <MaterialCommunityIcons name="scale-balance" size={24} color={color as string} /> }} />    </Tabs>
  );
}
