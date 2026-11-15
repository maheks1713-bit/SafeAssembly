// Screen 3: Agent Activity. Every agent_log row, live, with handoffs and the reasoning behind each step.
import { useEffect, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AgentIcon } from "@/components/AgentIcon";
import { HumanApprovedBadge, Tag } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { clock } from "@/lib/format";
import type { AgentLog, Draft } from "@/lib/types";

const FILTERS = ["All", "Monitor", "Dispatcher", "Comms", "Planner", "Rights", "Report", "Human"] as const;
type Filter = (typeof FILTERS)[number];

export default function Agents() {
  const logs = useTable("agent_log");
  const drafts = useTable("drafts");
  const [filter, setFilter] = useState<Filter>("All");
  const [open, setOpen] = useState<string | null>(null);
  const shown = (filter === "All" ? logs : logs.filter((l) => l.agent === filter)).slice(0, 80);

  return (
    <Screen eyebrow="6 agents working · live" title="Agent activity">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 18 }} style={{ marginHorizontal: -16, paddingHorizontal: 16, flexGrow: 0 }}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="tab" accessibilityState={{ selected: filter === f }}
            style={[styles.filter, filter === f && styles.filterOn]}>
            <Text style={[styles.filterText, filter === f && { color: C.white }]}>{f === "Human" ? "Organizer" : f}</Text>
          </Pressable>
        ))}
        <View style={{ width: 16 }} />
      </ScrollView>

      {shown.length === 0 && <Text style={T.muted}>No activity yet. Tap a marshal button or use the Scenario Injector.</Text>}
      {shown.map((l, i) => (
        <Row key={l.id} log={l} last={i === shown.length - 1} drafts={drafts}
          expanded={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />
      ))}
    </Screen>
  );
}

function Row({ log, last, drafts, expanded, onToggle }: { log: AgentLog; last: boolean; drafts: Draft[]; expanded: boolean; onToggle: () => void }) {
  // New rows fade + slide in so judges can see the handoff happen.
  const [anim] = useState(() => new Animated.Value(Date.now() - new Date(log.created_at).getTime() < 15_000 ? 0 : 1));
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: true }).start(); }, [anim]);

  const out = log.output_json ?? {};
  const draft = out.draft_id ? drafts.find((d) => d.id === out.draft_id) : undefined;
  const handoff: string | null = out.handoff ?? null;
  const name = log.agent === "Human" ? "Organizer" : log.agent;
  const { why, ...raw } = out;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <Pressable onPress={onToggle} style={styles.row} accessibilityRole="button" accessibilityHint="Shows why the agent did this">
        <View style={{ alignItems: "center" }}>
          <AgentIcon agent={log.agent} size={44} />
          {!last && <View style={styles.line} />}
        </View>
        <View style={{ flex: 1, paddingBottom: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={[T.cardTitle, { fontSize: 18 }]}>{name}</Text>
            <Text style={T.muted}>{clock(log.created_at)}</Text>
            <View style={{ flex: 1 }} />
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
          </View>
          <Text style={[T.body, { fontSize: 16, lineHeight: 23, marginTop: 4 }]}>{log.summary}</Text>

          {handoff && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Feather name="arrow-right" size={15} color={C.teal} />
              <Text style={{ fontFamily: F.semibold, color: C.teal, fontSize: 14 }}>Handed to {handoff}</Text>
            </View>
          )}
          {draft?.status === "pending" && <Tag text="Waiting for your approval" bg="#FDF0D0" fg={C.warningInk} style={{ marginTop: 10 }} />}
          {draft?.status === "approved" && <View style={{ marginTop: 10 }}><HumanApprovedBadge /></View>}
          {draft?.status === "rejected" && <Tag text="Rejected by organizer" bg="#EEF0EE" fg={C.muted} style={{ marginTop: 10 }} />}
          {out.source === "cache" && <Text style={[T.muted, { fontSize: 12, marginTop: 6 }]}>Served from demo-safety cache</Text>}

          {expanded && (
            <View style={styles.why}>
              <Text style={T.label}>Why</Text>
              <Text style={[T.body, { marginTop: 6, color: C.muted, fontSize: 15 }]}>{why ?? "Logged action."}</Text>
              <View style={styles.json}>
                <Text style={styles.jsonText}>{JSON.stringify(raw, null, 2)}</Text>
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  filterOn: { backgroundColor: C.ink, borderColor: C.ink },
  filterText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  row: { flexDirection: "row", gap: 14 },
  line: { width: 2, flex: 1, backgroundColor: C.line, marginTop: 6 },
  why: { marginTop: 12, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14 },
  json: { backgroundColor: "#F2F4F2", borderRadius: 10, padding: 10, marginTop: 10 },
  jsonText: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 12, color: C.ink },
});
