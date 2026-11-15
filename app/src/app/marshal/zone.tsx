// Screen 5: Marshal home (My zone). Big targets: used in the cold, with gloves on.
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Button, ErrorNote } from "@/components/ui";
import { C, F, S, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { acknowledge, sendReport } from "@/lib/api";
import { setCallsign } from "@/lib/session";
import { useMe } from "@/lib/useMe";
import { ago, clock, fmtTemp, latestWeather, useNow, ZONE_NAME } from "@/lib/format";
import type { ReportType } from "@/lib/types";

const LEVELS = [
  { n: 1, bg: "#E6F2EA", fg: C.ok }, { n: 2, bg: "#E6F2EA", fg: C.ok }, { n: 3, bg: "#FDF3DE", fg: C.warningInk },
  { n: 4, bg: "#FCE2A8", fg: C.warningInk }, { n: 5, bg: C.critical, fg: C.white },
];

export default function MarshalHome() {
  const now = useNow(10_000);
  const { callsign, me, mine, volunteers } = useMe();
  const event = useTable("events")[0];
  const reports = useTable("reports");
  const wx = latestWeather(useTable("signals"));
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const zone = me?.zone_id ?? "barrington_exit";
  const latest = mine[0];
  const lastCrowd = reports.find((r) => r.zone_id === zone && r.type === "crowd");
  const roleLabel = me?.role === "medic" ? "Medic" : me?.role === "legal_observer" ? "Legal observer" : "Marshal";

  async function report(type: ReportType, level: number | null = null) {
    const key = level ? `crowd${level}` : type;
    setSending(key); setErr(null); setSent(null);
    try {
      await sendReport(zone, type, level);
      setSent(type === "crowd" ? `Crowd level ${level} sent. Monitor is checking it.` : "Sent to the organizer. Monitor is checking it.");
    } catch (e) {
      setErr(`Couldn't send: ${(e as Error).message}`);
    } finally {
      setSending(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: C.deepTeal }}>
        <View style={styles.header}>
          <Pressable onPress={() => setPicking(true)} style={styles.avatar} accessibilityRole="button" accessibilityLabel={`You are ${callsign}. Change callsign`}>
            <Text style={styles.avatarText} numberOfLines={1} adjustsFontSizeToFit>{callsign}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub} numberOfLines={1}>{roleLabel} · {event?.name ?? "Halifax Climate Vigil"}</Text>
            <Text style={styles.headerZone}>{ZONE_NAME[zone]}</Text>
          </View>
          {wx && <Text style={styles.feels}>{fmtTemp(wx.feels)} feels</Text>}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 28 }}>
        {latest ? (
          <View style={[styles.instruction, latest.acknowledged && { borderColor: C.line, borderWidth: 1 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {!latest.acknowledged && <View style={styles.newTag}><Text style={styles.newTagText}>NEW</Text></View>}
              <Text style={[T.muted, { fontFamily: F.semibold, fontSize: 15 }]}>From Dispatcher · {clock(latest.created_at)}</Text>
            </View>
            <Text style={[T.marshalInstruction, { fontSize: 22, lineHeight: 30, marginTop: 10 }]} accessibilityLiveRegion="assertive">{latest.instruction}</Text>
            {latest.acknowledged ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
                <Feather name="check-circle" size={18} color={C.ok} />
                <Text style={{ fontFamily: F.semibold, color: C.ok, fontSize: 15 }}>Acknowledged</Text>
              </View>
            ) : (
              <Button title="Got it" big style={{ marginTop: 16 }} onPress={() => acknowledge(latest.id).catch((e) => setErr(e.message))} />
            )}
          </View>
        ) : (
          <View style={[styles.instruction, { borderColor: C.line, borderWidth: 1 }]}>
            <Text style={[T.body, { fontSize: 16 }]}>No instructions yet. Stay with your zone; new instructions from Dispatcher appear here and buzz your phone.</Text>
          </View>
        )}

        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Crowd level here</Text>
          {lastCrowd && <Text style={T.muted}>Last sent {ago(lastCrowd.created_at, now) === "now" ? "just now" : `${ago(lastCrowd.created_at, now)} ago`}</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {LEVELS.map((l) => {
            const selected = lastCrowd?.level === l.n && now - new Date(lastCrowd.created_at).getTime() < 15 * 60_000;
            return (
              <Pressable key={l.n} onPress={() => report("crowd", l.n)} disabled={!!sending}
                accessibilityRole="button" accessibilityLabel={`Crowd level ${l.n}${l.n === 1 ? ", room to move" : l.n === 5 ? ", packed, can't move" : ""}`}
                style={({ pressed }) => [styles.level, { backgroundColor: l.bg }, selected && { borderColor: C.ink, borderWidth: 3 }, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.levelText, { color: l.fg }]}>{sending === `crowd${l.n}` ? "…" : l.n}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.rowBetween, { marginTop: 6 }]}>
          <Text style={T.muted}>Room to move</Text>
          <Text style={T.muted}>{"Packed, can't move"}</Text>
        </View>

        <Text style={[styles.h2, { marginTop: 22, marginBottom: 12 }]}>Report now</Text>
        <Button title="Medical help" icon="plus" variant="danger" big style={{ minHeight: 64 }} loading={sending === "medical"} disabled={!!sending} onPress={() => report("medical")} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button title="Exit blocked" icon="slash" variant="ghost" big style={{ flex: 1 }} textStyle={{ fontSize: 17 }}
            loading={sending === "blocked_exit"} disabled={!!sending} onPress={() => report("blocked_exit")} />
          <Button title="Something else" icon="message-square" variant="ghost" big style={{ flex: 1 }} textStyle={{ fontSize: 17 }}
            loading={sending === "other"} disabled={!!sending} onPress={() => report("other")} />
        </View>

        {sent && (
          <View style={styles.sent} accessibilityLiveRegion="polite">
            <Feather name="check" size={18} color={C.ok} />
            <Text style={[T.body, { color: C.ok, flex: 1 }]}>{sent}</Text>
          </View>
        )}
        {err && <View style={{ marginTop: 12 }}><ErrorNote message={err} /></View>}

        <View style={styles.privacy}>
          <Feather name="shield" size={18} color={C.teal} />
          <Text style={[T.muted, { flex: 1, fontSize: 14 }]}>Reports share your zone only. No names, photos or GPS.</Text>
        </View>
        <Pressable onPress={() => router.replace("/")} style={{ alignSelf: "center", padding: 10 }} accessibilityRole="button">
          <Text style={{ fontFamily: F.semibold, color: C.muted }}>Switch role</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <View style={styles.sheet}>
            <Text style={[T.cardTitle, { fontSize: 18, marginBottom: 12 }]}>Which volunteer are you?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {volunteers.filter((v) => v.role !== "legal_observer").map((v) => (
                <Pressable key={v.id} onPress={() => { setCallsign(v.callsign); setPicking(false); setSent(null); }}
                  style={[styles.pick, v.callsign === callsign && { backgroundColor: C.teal, borderColor: C.teal }]}>
                  <Text style={[{ fontFamily: F.bold, fontSize: 16, color: C.ink }, v.callsign === callsign && { color: C.white }]}>{v.callsign}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: S.pad, paddingTop: 12, paddingBottom: 18 },
  avatar: { width: 60, height: 60, borderRadius: 14, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  avatarText: { fontFamily: F.title, fontSize: 24, color: C.deepTeal },
  headerSub: { fontFamily: F.body, fontSize: 15, color: "#CFE3E0" },
  headerZone: { fontFamily: F.bold, fontSize: 22, color: C.white, marginTop: 2 },
  feels: { fontFamily: F.bold, fontSize: 16, color: "#F5C76B" },
  instruction: { backgroundColor: C.white, borderRadius: 18, borderWidth: 2, borderColor: C.teal, padding: 18, marginBottom: 22 },
  newTag: { backgroundColor: C.teal, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  newTagText: { fontFamily: F.bold, fontSize: 12, color: C.white, letterSpacing: 0.5 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  h2: { fontFamily: F.bold, fontSize: 19, color: C.ink },
  level: { flex: 1, height: 72, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  levelText: { fontFamily: F.bold, fontSize: 26 },
  sent: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: C.okBg, borderRadius: 12, padding: 12, marginTop: 14 },
  privacy: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 28 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, paddingBottom: 40 },
  pick: { borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minWidth: 64, alignItems: "center" },
});
