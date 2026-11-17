// Screen 8: Event report (Report Agent). Opened from Command -> "End event and generate report".
// Lives on the root Stack, not in the organizer tabs: Expo Router redirects hidden tabs (href: null)
// back to the first tab, which made the button look like it only refreshed Command.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AgentGlyph } from "@/components/AgentIcon";
import { Button, Card, ErrorNote, Thinking } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { generateReport } from "@/lib/api";
import { clock } from "@/lib/format";
import { pdf, pdfHtml, sharePdf } from "@/lib/pdf";
import type { EventReport } from "@/lib/types";
import { confirm } from "@/lib/confirm";

export default function Report() {
  const event = useTable("events")[0];
  const stored = event?.facts_json?.report;
  const [fresh, setReport] = useState<EventReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const report = fresh ?? (event?.status === "ended" ? stored ?? null : null);

  async function run() {
    setBusy(true); setErr(null);
    try { setReport(await generateReport()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const confirmEnd = () => confirm("End the event?", "The Report Agent will write the incident report from the agent log.", "End event", run);

  async function share() {
    if (!report) return;
    try {
      await sharePdf(pdfHtml(
        "Event report", `${report.event_name} · ended ${clock(report.ended_at)}`,
        [
          ["Summary", `<p>${pdf.md(report.summary)}</p>`],
          ["Stats", `<table><tr><td>Alerts</td><td>${report.stats.alerts}</td></tr><tr><td>People moved</td><td>${report.stats.people_moved}</td></tr><tr><td>Corrections</td><td>${report.stats.corrections}</td></tr><tr><td>911 calls</td><td>${report.stats.calls_911}</td></tr></table>`],
          ["Timeline", `<table>${report.timeline.map((t) => `<tr><td>${pdf.esc(t.time)}</td><td>${pdf.esc(t.text)}</td></tr>`).join("")}</table>`],
          ["Lessons for next time", `<ul>${report.lessons.map((l) => `<li>${pdf.esc(l)}</li>`).join("")}</ul>`],
        ],
        report.privacy,
      ), "SafeAssembly-event-report");
    } catch (e) { setErr((e as Error).message); }
  }

  const eyebrow = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <AgentGlyph agent="Report" size={16} color={C.teal} />
      <Text style={[T.muted, { fontSize: 15, fontFamily: F.semibold }]}>Report Agent{report ? ` · ${clock(report.generated_at)}` : ""}</Text>
    </View>
  );

  return (
    <Screen eyebrowNode={eyebrow} title="Event report" bottomInset
      right={<Button title="Back" variant="ghost" icon="arrow-left"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/organizer/command"))} />}
      footer={report && !busy ? (
        <>
          <Button title="Export PDF" variant="secondary" style={{ flex: 1 }} onPress={share} />
          <Button title="Share" icon="share" style={{ flex: 1 }} onPress={share} />
        </>
      ) : undefined}>
      {!report && !busy && (
        <Card>
          <Text style={[T.body, { fontSize: 15 }]}>
            End the event and the Report Agent turns the agent log, alerts and approvals into an after-action report in one tap.
          </Text>
          <Button title="End event and generate report" icon="file-text" style={{ marginTop: 14 }} onPress={confirmEnd} />
        </Card>
      )}
      {busy && <Thinking label="Report Agent is writing the incident report..." />}
      {err && <View style={{ marginTop: 12 }}><ErrorNote message={err} /></View>}

      {report && (
        <>
          <Text style={[T.body, { fontSize: 16, color: C.muted, marginTop: -8, marginBottom: 14 }]}>
            {report.event_name} · ended {clock(report.ended_at)}
          </Text>
          <View style={styles.stats}>
            {([["Alerts", report.stats.alerts], ["People moved", report.stats.people_moved],
              [report.stats.corrections === 1 ? "Correction" : "Corrections", report.stats.corrections],
              [report.stats.calls_911 === 1 ? "911 call" : "911 calls", report.stats.calls_911]] as const).map(([label, n]) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statN}>{n}</Text>
                <Text style={T.muted}>{label}</Text>
              </View>
            ))}
          </View>

          <Card style={{ marginTop: 14 }}>
            <Text style={[T.body, { fontSize: 15, lineHeight: 22 }]}>{report.summary}</Text>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Text style={[T.cardTitle, { fontSize: 18, marginBottom: 8 }]}>Timeline</Text>
            {report.timeline.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 14, paddingVertical: 6 }}>
                <Text style={[T.body, { fontFamily: F.bold, color: C.muted, width: 70 }]}>{t.time}</Text>
                <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{t.text}</Text>
              </View>
            ))}
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Text style={[T.cardTitle, { fontSize: 18, marginBottom: 8 }]}>Lessons for next time</Text>
            {report.lessons.map((l, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                <Text style={T.body}>•</Text>
                <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{l}</Text>
              </View>
            ))}
          </Card>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <Feather name="shield" size={16} color={C.muted} />
            <Text style={[T.muted, { flex: 1 }]}>{report.privacy}</Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, minHeight: 92 },
  statN: { fontFamily: F.title, fontSize: 30, color: C.ink },
});
