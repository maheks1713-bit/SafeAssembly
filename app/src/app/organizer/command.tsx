// Screen 2: Live Command (organizer home).
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ZoneMap } from "@/components/ZoneMap";
import { Button, Card, ErrorNote, SectionLabel, SeverityChip, Thinking } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { resolveAlert } from "@/lib/api";
import { ago, alertTitle, callsigns, fmtTemp, latestWeather, useNow } from "@/lib/format";
import type { Alert, Assignment, Volunteer } from "@/lib/types";

export default function Command() {
  const now = useNow();
  const event = useTable("events")[0];
  const zones = useTable("zones");
  const volunteers = useTable("volunteers");
  const alerts = useTable("alerts");
  const reports = useTable("reports");
  const signals = useTable("signals");
  const drafts = useTable("drafts");
  const assignments = useTable("assignments");
  const logs = useTable("agent_log");

  const open = alerts.filter((a) => a.status === "open").sort((a, b) => b.severity - a.severity || b.created_at.localeCompare(a.created_at));
  const pending = drafts.filter((d) => d.status === "pending").length;
  const wx = latestWeather(signals);
  const ended = event?.status === "ended";

  // "Monitor is analysing..." while a fresh report hasn't produced an agent_log row yet.
  const lastReport = reports[0];
  const analysing = lastReport && now - new Date(lastReport.created_at).getTime() < 20_000 &&
    (!logs[0] || logs[0].created_at < lastReport.created_at);

  const started = Boolean(event?.start_time) && new Date(event!.start_time).getTime() < now;
  const liveFor = started ? ago(event!.start_time, now) : "";

  return (
    <Screen
      eyebrowNode={
        <View style={styles.topRow}>
          <View style={styles.live}>
            <View style={[styles.liveDot, ended && { backgroundColor: C.muted }]} />
            <Text style={[styles.liveText, ended && { color: C.muted }]}>
              {ended ? "ENDED" : started ? `LIVE · ${liveFor}` : "LIVE"}
            </Text>
          </View>
          {wx && (
            <View style={styles.wx} accessibilityLabel={`Weather ${wx.temp} degrees, feels like ${wx.feels}, wind ${wx.wind} kilometres per hour`}>
              <Feather name="sun" size={14} color={C.warningInk} />
              <Text style={styles.wxText}>{fmtTemp(wx.temp)}C, feels {fmtTemp(wx.feels)} · wind {wx.wind} km/h</Text>
            </View>
          )}
        </View>
      }
      title={event?.name ?? "Halifax Climate Vigil"}>
      <ZoneMap zones={zones} volunteers={volunteers} alerts={alerts} reports={reports} />

      {pending > 0 && (
        <Pressable style={styles.banner} onPress={() => router.push("/organizer/approvals")} accessibilityRole="button">
          <View style={styles.bannerCount}><Text style={styles.bannerCountText}>{pending}</Text></View>
          <Text style={styles.bannerText}>{pending === 1 ? "Draft" : "Drafts"} waiting for your approval</Text>
          <Feather name="chevron-right" size={22} color={C.white} />
        </Pressable>
      )}

      {analysing && <View style={{ marginTop: 14 }}><Thinking label="Monitor is analysing a new report..." /></View>}

      <SectionLabel>Open alerts · {open.length}</SectionLabel>
      {open.length === 0 && (
        <Card><Text style={T.body}>All clear. Monitor is watching marshal reports, weather and posts.</Text></Card>
      )}
      <View style={{ gap: 12 }}>
        {open.map((a) => <AlertCard key={a.id} alert={a} assignments={assignments} volunteers={volunteers} now={now} />)}
      </View>

      <Button title={ended ? "View event report" : "End event and generate report"} variant="secondary" icon="file-text"
        style={{ marginTop: 28 }} onPress={() => router.push("/organizer/report")} />
      <Button title="Switch role" variant="ghost" icon="log-out" style={{ marginTop: 10 }} onPress={() => router.replace("/")} />
    </Screen>
  );
}

function AlertCard({ alert, assignments, volunteers, now }: { alert: Alert; assignments: Assignment[]; volunteers: Volunteer[]; now: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = assignments.filter((a) => a.alert_id === alert.id);
  const sent = callsigns(mine.filter((a) => a.kind === "move").map((a) => a.volunteer_id), volunteers);
  const held = callsigns(mine.filter((a) => a.kind === "hold").map((a) => a.volunteer_id), volunteers);
  const crit = alert.severity >= 3;

  return (
    <Card tone={crit ? "critical" : alert.severity === 2 ? "warning" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <SeverityChip severity={alert.severity} />
        <Text style={[T.cardTitle, { flex: 1, fontSize: 18 }]}>{alertTitle(alert)}</Text>
        <Text style={T.muted}>{ago(alert.created_at, now)}</Text>
      </View>
      <Text style={[T.body, { fontSize: 15, marginTop: 8, color: C.muted }]}>{alert.explanation}</Text>
      {(sent.length > 0 || held.length > 0) && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}>
          <Feather name="navigation" size={15} color={C.teal} />
          <Text style={[T.body, { color: C.teal, fontFamily: F.semibold, flex: 1 }]}>
            {sent.length ? `Dispatcher sent ${sent.join(", ")}` : "Dispatcher"}{held.length ? ` · ${held.join(", ")} holding` : ""}
          </Text>
        </View>
      )}
      {err && <View style={{ marginTop: 8 }}><ErrorNote message={err} /></View>}
      <Pressable onPress={async () => { setBusy(true); setErr(null); try { await resolveAlert(alert.id); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}
        style={{ alignSelf: "flex-end", marginTop: 8, padding: 6 }} accessibilityRole="button" disabled={busy}>
        <Text style={{ fontFamily: F.semibold, color: C.muted, fontSize: 14 }}>{busy ? "Marking..." : "Mark handled"}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  live: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ok },
  liveText: { fontFamily: F.bold, fontSize: 15, color: C.ok },
  wx: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FDF0D0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  wxText: { fontFamily: F.semibold, fontSize: 13, color: C.warningInk },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.deepTeal, borderRadius: 14, padding: 16, marginTop: 16 },
  bannerCount: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  bannerCountText: { fontFamily: F.bold, color: C.deepTeal, fontSize: 15 },
  bannerText: { flex: 1, fontFamily: F.bold, fontSize: 17, color: C.white },
});
