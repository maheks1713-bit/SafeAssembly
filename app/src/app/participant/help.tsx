// Participant tab 3: how you can help. Public offices to call or email, with an AI-drafted email
// the person edits and sends themselves. Each draft is different (see draftEmail in lib/api.ts).
// If the event doesn't need calls or emails (cause.action_needed = false), it says showing up is enough.
import { useState } from "react";
import { Linking, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button, Card, ErrorNote, SectionLabel, Tag, Thinking } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { draftEmail } from "@/lib/api";
import { DEFAULT_CAUSE } from "@/lib/cause";
import { info } from "@/lib/confirm";
import type { Cause, Contact, EmailDraft } from "@/lib/types";

type Ev = { name: string; place: string; time: string };

async function open(url: string, what: string) {
  try { await Linking.openURL(url); } catch { info(`Couldn't open ${what}`, "Your phone has no app for this. You can copy the details instead."); }
}

export default function Help() {
  const event = useTable("events")[0];
  const facts = event?.facts_json ?? {};
  const cause = facts.cause ?? DEFAULT_CAUSE;
  const ev: Ev = {
    name: event?.name ?? "Halifax Climate Vigil",
    place: facts.place ?? event?.location ?? "Grand Parade",
    time: facts.time ?? "Sat 6-8 PM",
  };

  if (!cause.action_needed || cause.contacts.length === 0) return <JustShowUp ev={ev} />;

  return (
    <Screen eyebrow="Make your voice heard" title="How you can help">
      <Card tone="teal">
        <Text style={T.label}>What we are asking for</Text>
        <Text style={[T.body, { fontSize: 17, lineHeight: 24, fontFamily: F.semibold, marginTop: 6 }]}>
          {cause.ask.charAt(0).toUpperCase() + cause.ask.slice(1)}.
        </Text>
        <Text style={[T.body, { marginTop: 8, color: C.muted }]}>
          A short call or a personal email shows leaders that many people care. Be polite, be brief, say you live here.
        </Text>
      </Card>

      <SectionLabel style={{ marginTop: 24 }}>Who to contact</SectionLabel>
      <View style={{ gap: 12 }}>
        {cause.contacts.map((c) => <ContactCard key={c.id} contact={c} cause={cause} ev={ev} />)}
      </View>

      <View style={styles.note}>
        <Feather name="shield" size={16} color={C.muted} />
        <Text style={[T.muted, { flex: 1 }]}>
          SafeAssembly never sends anything for you. Drafts are written by AI: read them, make them yours, then send from your own email.
        </Text>
      </View>
    </Screen>
  );
}

function ContactCard({ contact, cause, ev }: { contact: Contact; cause: Cause; ev: Ev }) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [history, setHistory] = useState<EmailDraft[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setExpanded(true); setBusy(true); setErr(null);
    try {
      const d = await draftEmail(cause, contact, ev, history);
      setDraft(d);
      setHistory((h) => [...h, d]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const send = () => {
    if (!draft) return;
    const q = `subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    open(`mailto:${contact.email ?? ""}?${q}`, "your email app");
  };
  const share = () => {
    if (draft) Share.share({ message: `${draft.subject}\n\n${draft.body}` }).catch(() => {});
  };

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.iconTile}><Feather name="briefcase" size={18} color={C.teal} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[T.cardTitle, { fontSize: 17 }]}>{contact.title}</Text>
          <Text style={T.muted}>{contact.office}</Text>
        </View>
      </View>

      {(contact.phone || contact.email) && (
        <View style={{ marginTop: 10, gap: 4 }}>
          {contact.phone && <Text style={T.body}><Text style={{ fontFamily: F.semibold }}>Phone: </Text>{contact.phone}</Text>}
          {contact.email && <Text style={T.body} selectable><Text style={{ fontFamily: F.semibold }}>Email: </Text>{contact.email}</Text>}
        </View>
      )}

      <View style={styles.actions}>
        {contact.phone && (
          <Button title="Call" icon="phone" variant="secondary" style={{ flex: 1 }}
            onPress={() => open(`tel:${contact.phone!.replace(/[^\d+]/g, "")}`, "the phone app")} />
        )}
        {contact.lookup_url && (
          <Button title={contact.lookup_label ?? "Find yours"} icon="search" variant="secondary" style={{ flex: 1 }}
            onPress={() => open(contact.lookup_url!, "the browser")} />
        )}
      </View>
      {!expanded && (
        <Button title="Draft an email" icon="edit-3" style={{ marginTop: 10 }} onPress={generate} />
      )}

      {expanded && (
        <View style={{ marginTop: 14 }}>
          {busy && <Thinking label={draft ? "Writing a different email..." : "Writing your email..."} />}
          {err && <ErrorNote message={err} />}
          {draft && !busy && (
            <>
              <View style={[styles.head, { marginBottom: 8 }]}>
                <Text style={[T.cardTitle, { flex: 1 }]}>Your email</Text>
                <Tag text={draft.source === "gemini" ? "Written by AI" : "Written on this phone"} />
              </View>
              {!contact.email && (
                <Text style={[T.muted, { marginBottom: 8 }]}>
                  Use “{contact.lookup_label ?? "Find yours"}” to get their email address, then add it in your email app.
                </Text>
              )}
              <TextInput value={draft.subject} onChangeText={(subject) => setDraft({ ...draft, subject })}
                style={[styles.editor, { minHeight: 0, fontFamily: F.semibold }]} accessibilityLabel="Email subject. Editable." />
              <TextInput multiline value={draft.body} onChangeText={(body) => setDraft({ ...draft, body })}
                style={[styles.editor, { marginTop: 8 }]} accessibilityLabel="Email text. Editable." />
              <Text style={[T.muted, { marginTop: 6 }]}>Replace [Your name] and [Your neighbourhood or postal code] before you send.</Text>
              <View style={styles.actions}>
                <Button title="Regenerate" icon="refresh-cw" variant="ghost" style={{ flex: 1 }} onPress={generate} />
                <Button title="Share" icon="share" variant="ghost" style={{ flex: 1 }} onPress={share} />
              </View>
              <Button title="Open in email app" icon="send" style={{ marginTop: 10 }} onPress={send} />
            </>
          )}
          {!draft && !busy && err && <Button title="Try again" icon="refresh-cw" style={{ marginTop: 10 }} onPress={generate} />}
        </View>
      )}
    </Card>
  );
}

function JustShowUp({ ev }: { ev: Ev }) {
  const tips: [keyof typeof Feather.glyphMap, string][] = [
    ["users", "Come along, and bring a friend if you can."],
    ["check-circle", "Share only official updates from the Updates tab."],
    ["shield", "Keep it peaceful, follow the marshals and look out for the people around you."],
  ];
  return (
    <Screen eyebrow="How you can help" title="Just be there">
      <Card tone="teal">
        <Feather name="heart" size={28} color={C.teal} />
        <Text style={[T.cardTitle, { fontSize: 20, marginTop: 10 }]}>Participating is enough for this event.</Text>
        <Text style={[T.body, { fontSize: 15, marginTop: 6 }]}>
          There are no calls or emails to send for the {ev.name}. Showing up at {ev.place} is the most important thing you can do.
        </Text>
      </Card>
      <View style={{ gap: 10, marginTop: 16 }}>
        {tips.map(([icon, t]) => (
          <Card key={t} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Feather name={icon} size={20} color={C.teal} />
            <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{t}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  editor: { borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, padding: 12, minHeight: 200, fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.ink, textAlignVertical: "top" },
  note: { flexDirection: "row", gap: 8, marginTop: 18 },
});
