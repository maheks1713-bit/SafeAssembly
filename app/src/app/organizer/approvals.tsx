// Screen 4: Approvals inbox. Nothing goes public, and no 911 call is placed, without a person tapping.
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AgentIcon } from "@/components/AgentIcon";
import { Button, Card, ErrorNote, HumanApprovedBadge, SectionLabel, Segmented, Tag } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { approveDraft, rejectDraft } from "@/lib/api";
import { ago, clock, RISK_LABEL, ZONE_NAME, useNow } from "@/lib/format";
import type { Draft } from "@/lib/types";
import { confirm } from "@/lib/confirm";

export default function Approvals() {
  const now = useNow();
  const drafts = useTable("drafts");
  const pending = drafts.filter((d) => d.status === "pending")
    .sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));
  const decided = drafts.filter((d) => d.status !== "pending")
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

  return (
    <Screen eyebrow="Nothing goes public without you" title={`Approvals · ${pending.length}`}>
      {pending.length === 0 && (
        <Card><Text style={T.body}>Nothing waiting. When an agent drafts a correction, announcement or 911 recommendation, it lands here first.</Text></Card>
      )}
      <View style={{ gap: 14 }}>
        {pending.map((d) => d.kind === "escalation_911"
          ? <EscalationCard key={d.id} draft={d} now={now} />
          : <DraftCard key={d.id} draft={d} now={now} />)}
      </View>

      {decided.length > 0 && <SectionLabel style={{ marginTop: 28 }}>Sent earlier</SectionLabel>}
      <View style={{ gap: 10 }}>
        {decided.map((d) => (
          <Card key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.cardTitle, { fontSize: 16 }]} numberOfLines={2}>{decidedTitle(d)}</Text>
              <Text style={[T.muted, { marginTop: 3 }]}>{KIND[d.kind]} · {clock(d.decided_at ?? d.created_at)}</Text>
            </View>
            {d.status === "approved" ? <HumanApprovedBadge /> : <Tag text={d.kind === "escalation_911" ? "Not needed" : "Rejected"} bg="#EEF0EE" fg={C.muted} />}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const KIND: Record<Draft["kind"], string> = { correction: "Correction", announcement: "Announcement", escalation_911: "911 decision" };
const rank = (d: Draft) => (d.kind === "escalation_911" ? 0 : d.meta?.priority === "high" ? 1 : 2);
function decidedTitle(d: Draft) {
  if (d.kind === "escalation_911") return d.status === "approved" ? "Organizer chose to call 911" : "911 call not needed";
  if (d.kind === "announcement") return d.reason ?? d.body_en ?? "Announcement";
  return d.body_en ?? "Correction";
}

function useAct(draft: Draft) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run(kind: "approve" | "reject", edits?: { body_en?: string; body_fr?: string }) {
    setBusy(kind); setErr(null);
    try { if (kind === "approve") await approveDraft(draft, edits); else await rejectDraft(draft); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  return { busy, err, run };
}

function EscalationCard({ draft, now }: { draft: Draft; now: number }) {
  const { busy, err, run } = useAct(draft);
  const risk = draft.meta?.risk_type ? RISK_LABEL[draft.meta.risk_type] : "Emergency";
  const zone = draft.meta?.zone ? ZONE_NAME[draft.meta.zone] : "";

  // DEMO SAFETY: this never dials. In production it would open the dialer with 911 ready; a human presses call.
  const confirmCall = () => confirm(
    "Call 911?",
    "Demo build: this logs your decision and does not dial.\n\nIn production, the phone dialer opens with 911 ready and you press call.",
    "Log: call 911", () => run("approve"), true,
  );

  return (
    <Card tone="critical">
      <View style={styles.head}>
        <View style={[styles.iconTile, { backgroundColor: C.criticalBg }]}><Feather name="alert-triangle" size={20} color={C.critical} /></View>
        <Text style={[T.cardTitle, { fontSize: 18, flex: 1 }]}>{risk}{zone ? ` at ${zone}` : ""}: call 911?</Text>
        <Text style={T.muted}>{ago(draft.created_at, now)}</Text>
      </View>
      <Text style={[T.body, { fontSize: 15, color: C.muted, marginTop: 10 }]}>{draft.body_en ?? draft.reason}</Text>
      {err && <View style={{ marginTop: 10 }}><ErrorNote message={err} /></View>}
      <View style={styles.actions}>
        <Button title="Not needed" variant="ghost" style={{ flex: 1 }} loading={busy === "reject"} disabled={!!busy} onPress={() => run("reject")} />
        <Button title="Call 911" variant="danger" icon="phone" style={{ flex: 1 }} loading={busy === "approve"} disabled={!!busy} onPress={confirmCall} />
      </View>
      <Text style={[T.muted, { marginTop: 10 }]}>SafeAssembly never calls emergency services by itself.</Text>
    </Card>
  );
}

function DraftCard({ draft, now }: { draft: Draft; now: number }) {
  const { busy, err, run } = useAct(draft);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [en, setEn] = useState(draft.body_en ?? "");
  const [fr, setFr] = useState(draft.body_fr ?? "");

  const incitement = draft.meta?.harm === "incitement";
  const isCorrection = draft.kind === "correction";
  const title = incitement ? "High priority: incitement" : isCorrection ? "Correct a false post" : "Public announcement";
  const verdict = (draft.meta?.verdict ?? "").toUpperCase();
  const edited = en !== (draft.body_en ?? "") || fr !== (draft.body_fr ?? "");

  return (
    <Card tone={incitement ? "critical" : undefined}>
      <View style={styles.head}>
        {incitement
          ? <View style={[styles.iconTile, { backgroundColor: C.criticalBg }]}><Feather name="alert-octagon" size={20} color={C.critical} /></View>
          : <AgentIcon agent={isCorrection ? "Comms" : "Dispatcher"} size={38} />}
        <Text style={[T.cardTitle, { fontSize: 18, flex: 1 }]}>{title}</Text>
        <Text style={T.muted}>{ago(draft.created_at, now)}</Text>
      </View>

      {draft.source_text && isCorrection && (
        <View style={styles.post}>
          <Text style={T.muted}>Spotted post{draft.meta?.shares ? ` · shared ${draft.meta.shares} times` : ""}</Text>
          <Text style={styles.struck}>{draft.source_text}</Text>
          <Tag text={incitement ? "INCITEMENT · never auto-replied" : `${verdict || "FALSE"} · contradicts event facts`}
            bg={C.critical} fg={C.white} style={{ marginTop: 8 }} />
        </View>
      )}

      <View style={[styles.head, { marginTop: 14 }]}>
        <Text style={[T.cardTitle, { flex: 1 }]}>{isCorrection ? (incitement ? "Draft calm reply" : "Draft correction") : "Draft announcement"}</Text>
        <Segmented small value={lang} onChange={setLang} options={[{ value: "en", label: "EN" }, { value: "fr", label: "FR" }]} />
      </View>
      <TextInput
        multiline value={lang === "en" ? en : fr} onChangeText={lang === "en" ? setEn : setFr}
        style={styles.editor} accessibilityLabel={`Draft text, ${lang === "en" ? "English" : "French"}. Editable.`} />
      {edited && <Text style={[T.muted, { marginTop: 6 }]}>Edited by you</Text>}
      {err && <View style={{ marginTop: 10 }}><ErrorNote message={err} /></View>}

      <View style={styles.actions}>
        <Button title="Reject" variant="ghost" style={{ flex: 1 }} loading={busy === "reject"} disabled={!!busy} onPress={() => run("reject")} />
        <Button title="Approve & send" style={{ flex: 2 }} loading={busy === "approve"} disabled={!!busy || !en.trim()}
          onPress={() => run("approve", edited ? { body_en: en, body_fr: fr } : undefined)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 12, marginTop: 14 },
  post: { backgroundColor: "#F2F4F2", borderRadius: 12, padding: 14, marginTop: 14 },
  struck: { fontFamily: F.medium, fontSize: 16, lineHeight: 23, color: C.muted, textDecorationLine: "line-through", textDecorationColor: C.critical, marginTop: 6 },
  editor: { borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, padding: 14, marginTop: 10, minHeight: 96, fontFamily: F.body, fontSize: 16, lineHeight: 23, color: C.ink, textAlignVertical: "top" },
});
