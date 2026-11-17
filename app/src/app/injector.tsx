// Scenario Injector (DEMO OPERATOR ONLY). Opened by long-pressing the logo on the role picker.
// Each button calls one server route; the server inserts the row and runs /tick so the other phones change live.
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { C, F, S } from "@/lib/theme";
import { health, inject, injectPaste, resetDemo, type InjectKind } from "@/lib/api";
import { API_URL, USE_MOCKS } from "@/lib/config";
import type { Health } from "@/lib/types";
import { confirm } from "@/lib/confirm";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function Injector() {
  const [status, setStatus] = useState<Health | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [paste, setPaste] = useState("");

  const ping = useCallback(async () => {
    try { setStatus(await health()); setOffline(null); } catch (e) { setOffline((e as Error).message); }
  }, []);
  useEffect(() => {
    const first = setTimeout(ping, 0); // async network poll, not derived state
    const t = setInterval(ping, 20_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [ping]);

  async function run(key: string, label: string, fn: () => Promise<unknown>) {
    setBusy(key); setLog(null);
    try { await fn(); setLog(`✓ ${label}: done. Watch the other phone.`); ping(); }
    catch (e) { setLog(`✗ ${label}: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }
  const btn = (kind: InjectKind, label: string, tone?: "bad" | "good") => (
    <Pressable key={kind} disabled={!!busy} onPress={() => run(kind, label, () => inject(kind))} accessibilityRole="button"
      style={({ pressed }) => [styles.btn, tone === "bad" && styles.bad, tone === "good" && styles.good, pressed && { opacity: 0.7 }, busy === kind && { opacity: 0.6 }]}>
      <Text style={[styles.btnText, tone && { textAlign: "center", color: tone === "bad" ? "#F5B5AC" : "#A6E3C4" }]}>{busy === kind ? "Running agents..." : label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.night }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={styles.badge}><Text style={styles.badgeText}>DEMO OPERATOR ONLY</Text></View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Close injector" style={{ padding: 8 }}>
            <Feather name="x" size={26} color="#B9C6C3" />
          </Pressable>
        </View>
        <Text style={styles.title}>Scenario Injector</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <View style={[styles.dot, { backgroundColor: offline ? C.critical : status ? "#3DDC84" : C.warning }]} />
          <Text style={styles.status}>
            {USE_MOCKS ? "Mock data mode: buttons do nothing (set Supabase + API URL in app/.env)"
              : offline ? `Server offline: ${offline}`
              : status ? `Server online · last tick ${status.last_tick ? time(status.last_tick) : "none yet"} · Gemini ${status.gemini}`
              : `Waking server ${API_URL}...`}
          </Text>
        </View>

        <Text style={styles.section}>MARSHAL REPORTS</Text>
        <View style={styles.row}>{btn("crowd5", "Crowd 5 at Barrington Exit")}{btn("medical", "Medical at Stage")}</View>

        <Text style={styles.section}>SIGNALS</Text>
        <View style={styles.row}>{btn("cold-snap", "Force cold snap (−16°)")}{btn("transit", "Transit detour on Barrington")}</View>

        <Text style={styles.section}>SOCIAL POSTS</Text>
        <View style={styles.row}>{btn("fake-cancel", "Fake cancel", "bad")}{btn("incitement", "Incitement", "bad")}{btn("accurate", "Accurate", "good")}</View>

        <Text style={[styles.btnText, { marginTop: 18, marginBottom: 10 }]}>Paste any post (let a judge try)</Text>
        <TextInput value={paste} onChangeText={setPaste} multiline placeholder="Paste a post about the event..." placeholderTextColor="#6F7F7C"
          style={styles.paste} />
        <Pressable disabled={!!busy || paste.trim().length < 3} accessibilityRole="button"
          onPress={() => run("paste", "Comms Agent", async () => { await injectPaste(paste); setPaste(""); })}
          style={({ pressed }) => [styles.mint, (pressed || busy === "paste") && { opacity: 0.7 }, paste.trim().length < 3 && { opacity: 0.5 }]}>
          <Text style={styles.mintText}>{busy === "paste" ? "Comms Agent is checking..." : "Run Comms Agent"}</Text>
        </Pressable>

        {log && <Text style={[styles.status, { marginTop: 16, color: log.startsWith("✓") ? "#A6E3C4" : "#F5B5AC" }]}>{log}</Text>}

        <Pressable disabled={!!busy} accessibilityRole="button" style={({ pressed }) => [styles.reset, pressed && { opacity: 0.7 }]}
          onPress={() => confirm("Reset demo?", "Deletes all reports, alerts, drafts and agent logs, and re-seeds the event.",
            "Reset", () => run("reset", "Reset demo", resetDemo), true)}>
          <Text style={styles.resetText}>{busy === "reset" ? "Resetting..." : "Reset demo"}</Text>
        </Pressable>
        <Text style={[styles.status, { textAlign: "center", marginTop: 10 }]}>Open: long-press the logo on the role picker</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: "#F5C76B", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  badgeText: { fontFamily: F.bold, fontSize: 13, letterSpacing: 1, color: C.night },
  title: { fontFamily: F.title, fontSize: 30, color: C.white, marginTop: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontFamily: F.body, fontSize: 14, color: "#B9C6C3", flex: 1 },
  section: { fontFamily: F.bold, fontSize: 13, letterSpacing: 1, color: "#9AAAA6", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, minHeight: 64, backgroundColor: C.nightCard, borderColor: C.nightLine, borderWidth: 1, borderRadius: 14, padding: 14, justifyContent: "center" },
  bad: { backgroundColor: "#2C1C1A", borderColor: "#5A2E29" },
  good: { backgroundColor: "#182A22", borderColor: "#2E5141" },
  btnText: { fontFamily: F.bold, fontSize: 16, color: C.white },
  paste: { minHeight: 90, backgroundColor: C.nightCard, borderColor: C.nightLine, borderWidth: 1, borderRadius: 14, padding: 14, color: C.white, fontFamily: F.body, fontSize: 16, textAlignVertical: "top" },
  mint: { backgroundColor: C.mint, borderRadius: 14, minHeight: 56, alignItems: "center", justifyContent: "center", marginTop: 12 },
  mintText: { fontFamily: F.bold, fontSize: 18, color: C.deepTeal },
  reset: { borderWidth: 1.5, borderColor: "#8C3A31", borderRadius: 14, minHeight: 56, alignItems: "center", justifyContent: "center", marginTop: 36 },
  resetText: { fontFamily: F.bold, fontSize: 18, color: "#F5B5AC" },
});
