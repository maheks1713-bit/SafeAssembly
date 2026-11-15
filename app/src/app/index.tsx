// Screen 1: Role picker. Long-press the logo to open the hidden Scenario Injector.
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, S } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { USE_MOCKS } from "@/lib/config";

export default function RolePicker() {
  const event = useTable("events")[0];
  const facts = event?.facts_json ?? {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.deepTeal }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onLongPress={() => router.push("/injector")} delayLongPress={600}
          accessibilityLabel="SafeAssembly logo" accessibilityHint="Demo operators: long-press to open the Scenario Injector">
          <View style={styles.logo}>
            <MaterialCommunityIcons name="shield-account-outline" size={42} color={C.deepTeal} />
          </View>
        </Pressable>
        <Text style={styles.brand} accessibilityRole="header">SafeAssembly</Text>
        <Text style={styles.tagline}>Agentic AI that keeps public gatherings safe, lawful and informed.</Text>

        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>YOUR EVENT</Text>
          <Text style={styles.eventName}>{event?.name ?? "Halifax Climate Vigil"}</Text>
          <Text style={styles.eventMeta}>
            {facts.place ?? event?.location ?? "Grand Parade"} · {facts.time ?? "Sat, 6:00–8:00 PM"} · {facts.expected_size ?? `~${event?.expected_size ?? 800} people`}
          </Text>
        </View>

        <Pressable style={({ pressed }) => [styles.role, styles.rolePrimary, pressed && { opacity: 0.85 }]} accessibilityRole="button"
          onPress={() => router.push("/organizer/command")}>
          <Feather name="map" size={28} color={C.deepTeal} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleTitle, { color: C.deepTeal }]}>{"I'm an organizer"}</Text>
            <Text style={[styles.roleSub, { color: C.deepTeal }]}>Plan, monitor and approve</Text>
          </View>
          <Feather name="chevron-right" size={24} color={C.deepTeal} />
        </Pressable>

        <Pressable style={({ pressed }) => [styles.role, styles.roleSecondary, pressed && { opacity: 0.85 }]} accessibilityRole="button"
          onPress={() => router.push("/marshal/zone")}>
          <Feather name="user" size={28} color={C.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.roleTitle}>{"I'm a marshal or medic"}</Text>
            <Text style={styles.roleSub}>Report and get assignments</Text>
          </View>
          <Feather name="chevron-right" size={24} color={C.white} />
        </Pressable>

        <View style={{ flex: 1, minHeight: 40 }} />

        <View style={styles.privacyRow}>
          {([["eye-off", "No faces"], ["user-x", "No names"], ["map-pin", "No tracking"]] as const).map(([icon, label]) => (
            <View key={label} style={styles.privacy}>
              <Feather name={icon} size={22} color={C.mint} />
              <Text style={styles.privacyText}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Nonpartisan. For peaceful assembly only.</Text>
        {USE_MOCKS && <Text style={[styles.footer, { color: C.mint, marginTop: 6 }]}>Demo data mode (no backend configured)</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingTop: 40 },
  logo: { width: 72, height: 72, borderRadius: 18, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  brand: { fontFamily: F.title, fontSize: 44, color: C.white, marginTop: 24, letterSpacing: -0.5 },
  tagline: { fontFamily: F.body, fontSize: 18, lineHeight: 26, color: "#CFE3E0", marginTop: 8 },
  eventCard: { marginTop: 28, borderRadius: S.radius, borderWidth: 1, borderColor: "#2F5A56", backgroundColor: "#1B4A46", padding: 18 },
  eventLabel: { fontFamily: F.bold, fontSize: 13, letterSpacing: 1, color: "#8FC9C1" },
  eventName: { fontFamily: F.bold, fontSize: 20, color: C.white, marginTop: 6 },
  eventMeta: { fontFamily: F.body, fontSize: 15, color: "#CFE3E0", marginTop: 4, lineHeight: 21 },
  role: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: S.radius, paddingHorizontal: 20, paddingVertical: 18, marginTop: 14, minHeight: 72 },
  rolePrimary: { backgroundColor: C.mint, marginTop: 28 },
  roleSecondary: { borderWidth: 1.5, borderColor: "#8AA9A5" },
  roleTitle: { fontFamily: F.bold, fontSize: 20, color: C.white },
  roleSub: { fontFamily: F.body, fontSize: 15, color: "#CFE3E0", marginTop: 2 },
  privacyRow: { flexDirection: "row", gap: 10 },
  privacy: { flex: 1, alignItems: "center", gap: 8, backgroundColor: "#1B4A46", borderRadius: 14, paddingVertical: 14 },
  privacyText: { fontFamily: F.bold, fontSize: 14, color: C.white },
  footer: { fontFamily: F.body, fontSize: 14, color: "#CFE3E0", textAlign: "center", marginTop: 14 },
});
