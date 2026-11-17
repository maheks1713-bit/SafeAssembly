// Screen 6: Event setup + Planner Agent (permit draft, checklist, route notes).
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AgentIcon } from "@/components/AgentIcon";
import { Button, Card, ErrorNote, Segmented, Tag, Thinking } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { generatePlan, markSubmitted } from "@/lib/api";
import { pdf, pdfHtml, sharePdf } from "@/lib/pdf";
import type { Plan } from "@/lib/types";

type Tab = "permit" | "checklist" | "route";
const FIELDS = [
  ["place", "Place"], ["when", "When"], ["size", "Expected size"], ["sound", "Amplified sound"],
] as const;

export default function PlanScreen() {
  const event = useTable("events")[0];
  const facts = event?.facts_json ?? {};
  const [local, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<Tab>("permit");
  const [busy, setBusy] = useState<"plan" | "submit" | "pdf" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState<typeof saved | null>(null); // non-null while editing
  const [toggled, setToggled] = useState<Record<string, boolean>>({}); // checklist taps, keyed per plan version

  // The stored plan (events.facts_json.plan) arrives live via Realtime; a just-generated one shows immediately.
  const stored = facts.plan ?? null;
  const plan = local && (!stored || local.generated_at >= stored.generated_at) ? local : stored;
  const saved = {
    place: facts.place ?? event?.location ?? "Grand Parade",
    when: facts.time ?? "Sat 6–8 PM",
    size: facts.expected_size ?? `~${event?.expected_size ?? 800} people`,
    sound: facts.amplified_sound ?? "Yes, one speaker",
  };
  const editing = draftForm !== null;
  const form = draftForm ?? saved;
  const setForm = (f: typeof saved) => setDraftForm(f);
  const setEditing = (on: boolean) => setDraftForm(on ? saved : null);
  const checkKey = (i: number) => `${plan?.generated_at}:${i}`;
  const checks = plan ? plan.checklist.map((c, i) => toggled[checkKey(i)] ?? c.done) : [];
  const setChecks = (i: number) => setToggled((t) => ({ ...t, [checkKey(i)]: !checks[i] }));

  async function generate() {
    setBusy("plan"); setErr(null); setDraftForm(null);
    try { setPlan(await generatePlan(form)); setTab("permit"); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  async function submit() {
    setBusy("submit"); setErr(null);
    try { setPlan(await markSubmitted()); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function share() {
    if (!plan) return;
    setBusy("pdf"); setErr(null);
    try {
      await sharePdf(pdfHtml(
        "Public gathering application (draft)", `${event?.name ?? "Event"} · ${form.place} · ${form.when}`,
        [
          ["Application", `<table>${plan.permit_fields.map((f) => `<tr><td>${pdf.esc(f.label)}</td><td>${pdf.esc(f.value)}</td></tr>`).join("")}</table>`],
          ["Questions for the city", `<ol>${plan.questions_for_city.map((q) => `<li>${pdf.esc(q)}</li>`).join("")}</ol>`],
          ["Safety checklist", `<table>${plan.checklist.map((c, i) => `<tr><td>${checks[i] ? "☑" : "☐"} ${pdf.esc(c.item)}</td><td>${pdf.esc(c.owner)} · ${pdf.esc(c.due)}</td></tr>`).join("")}</table>`],
          ["Route notes", `<p>${pdf.md(plan.route_notes)}</p>`],
        ],
        plan.disclaimer,
      ), "SafeAssembly-permit-draft");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  const done = checks.filter(Boolean).length;
  const seconds = plan ? Math.max(1, Math.round(plan.ms / 1000)) : 0;

  return (
    <Screen
      eyebrow={event?.name ?? "Halifax Climate Vigil"}
      title="Plan event"
      footer={plan && !busy ? (
        <>
          <Button title="Share PDF" variant="secondary" style={{ flex: 1 }} onPress={share} />
          <Button title={plan.submitted ? "Submitted" : "Mark as submitted"} icon={plan.submitted ? "check" : undefined}
            style={{ flex: 1.3 }} disabled={plan.submitted} onPress={submit} />
        </>
      ) : undefined}>
      <Card>
        {editing ? (
          <View style={{ gap: 12 }}>
            {FIELDS.map(([k, label]) => (
              <View key={k}>
                <Text style={T.muted}>{label}</Text>
                <TextInput value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} style={styles.input} accessibilityLabel={label} />
              </View>
            ))}
            <Button title={plan ? "Save and regenerate plan" : "Save and generate plan"} onPress={generate} />
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {FIELDS.map(([k, label]) => (
                <View key={k} style={styles.cell}>
                  <Text style={T.muted}>{label}</Text>
                  <Text style={[T.cardTitle, { fontSize: 17, marginTop: 2 }]}>{form[k]}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" style={{ marginTop: 6, alignSelf: "flex-start", paddingVertical: 4 }}>
              <Text style={{ fontFamily: F.bold, color: C.teal, fontSize: 16 }}>Edit details</Text>
            </Pressable>
          </>
        )}
      </Card>

      <View style={{ marginTop: 14 }}>
        {busy === "plan" ? (
          <Thinking label="Planner is drafting your permit..." />
        ) : plan ? (
          <View style={styles.banner}>
            <AgentIcon agent="Planner" size={36} solid />
            <Text style={[T.body, { flex: 1, fontSize: 15 }]}>
              <Text style={{ fontFamily: F.bold }}>Planner Agent</Text> drafted your plan in {seconds} s
            </Text>
            <Pressable onPress={generate} accessibilityRole="button" style={{ padding: 6 }}>
              <Text style={{ fontFamily: F.bold, color: C.teal, fontSize: 15 }}>Regenerate</Text>
            </Pressable>
          </View>
        ) : (
          <Button title="Generate plan" icon="zap" onPress={generate} />
        )}
      </View>
      {err && <View style={{ marginTop: 12 }}><ErrorNote message={err} /></View>}

      {plan && (
        <>
          <View style={{ marginTop: 14 }}>
            <Segmented value={tab} onChange={setTab} options={[
              { value: "permit", label: "Permit" },
              { value: "checklist", label: `Checklist ${done}/${checks.length}` },
              { value: "route", label: "Route" },
            ]} />
          </View>

          <Card style={{ marginTop: 12 }}>
            {tab === "permit" && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Text style={[T.cardTitle, { fontSize: 19, flex: 1 }]}>Public gathering application</Text>
                  {plan.submitted ? <Tag text="Submitted" bg={C.okBg} fg={C.ok} /> : <Tag text="Draft" bg="#FDF0D0" fg={C.warningInk} />}
                </View>
                {plan.permit_fields.map((f) => (
                  <View key={f.label} style={styles.fieldRow}>
                    <Text style={[T.muted, { width: "36%", fontSize: 15 }]}>{f.label}</Text>
                    <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{f.value}</Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <Text style={[T.cardTitle, { marginBottom: 6 }]}>Questions for the city</Text>
                {plan.questions_for_city.map((q, i) => <Text key={q} style={[T.body, { fontSize: 15, marginBottom: 4 }]}>{i + 1}. {q}</Text>)}
              </>
            )}
            {tab === "checklist" && plan.checklist.map((c, i) => (
              <Pressable key={c.item} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: checks[i] }}
                onPress={() => setChecks(i)}>
                <Feather name={checks[i] ? "check-square" : "square"} size={22} color={checks[i] ? C.ok : C.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontSize: 15 }, checks[i] && { color: C.muted }]}>{c.item}</Text>
                  <Text style={[T.muted, { fontSize: 12 }]}>{c.owner} · {c.due}</Text>
                </View>
              </Pressable>
            ))}
            {tab === "route" && <Text style={[T.body, { fontSize: 15, lineHeight: 23 }]}>{plan.route_notes}</Text>}
          </Card>

          <View style={styles.disclaimer}>
            <Feather name="info" size={16} color={C.warningInk} />
            <Text style={[T.body, { flex: 1, color: C.warningInk }]}>{plan.disclaimer}</Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  cell: { width: "50%" },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontFamily: F.body, fontSize: 16, color: C.ink, marginTop: 4 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.tint, borderRadius: 14, padding: 14 },
  fieldRow: { flexDirection: "row", gap: 12, paddingVertical: 7 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 12 },
  check: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 9 },
  disclaimer: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#FDF0D0", borderRadius: 12, padding: 12, marginTop: 12 },
});
