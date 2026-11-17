// Participant tab 2: public updates. Only drafts a person approved on the organizer's Approvals tab
// appear here (announcements and fact-checks). 911 decisions are internal and never shown.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card, HumanApprovedBadge, Segmented } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { ago, clock, useNow } from "@/lib/format";
import type { Draft } from "@/lib/types";

type Lang = "en" | "fr";
const L = {
  en: { eyebrow: "From the organizers", title: "Updates", empty: "No updates yet. Official announcements from the organizers will appear here.",
    announcement: "Announcement", correction: "Fact check", falseNote: "A false post is going around. Here are the facts:" },
  fr: { eyebrow: "Des organisateurs", title: "Mises à jour", empty: "Aucune mise à jour pour l'instant. Les annonces officielles des organisateurs apparaîtront ici.",
    announcement: "Annonce", correction: "Vérification", falseNote: "Une fausse publication circule. Voici les faits :" },
};

function text(d: Draft, lang: Lang) {
  const fr = d.body_fr?.trim();
  if (lang === "fr" && fr) return fr;
  return d.body_en?.trim() || d.reason || "";
}

export default function News() {
  const now = useNow();
  const [lang, setLang] = useState<Lang>("en");
  const updates = useTable("drafts")
    .filter((d) => d.status === "approved" && (d.kind === "announcement" || d.kind === "correction") && text(d, "en"))
    .sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));

  return (
    <Screen eyebrow={L[lang].eyebrow} title={L[lang].title}
      right={<Segmented small value={lang} onChange={setLang} options={[{ value: "en", label: "EN" }, { value: "fr", label: "FR" }]} />}>
      {updates.length === 0 && <Card><Text style={[T.body, { fontSize: 15 }]}>{L[lang].empty}</Text></Card>}
      <View style={{ gap: 12 }}>
        {updates.map((d, i) => {
          const fact = d.kind === "correction";
          const when = d.decided_at ?? d.created_at;
          return (
            <Card key={d.id} tone={i === 0 ? "teal" : undefined}>
              <View style={styles.head}>
                <View style={[styles.iconTile, fact && { backgroundColor: C.warningBg }]}>
                  <Feather name={fact ? "check-circle" : "volume-2"} size={18} color={fact ? C.warningInk : C.teal} />
                </View>
                <Text style={[T.cardTitle, { flex: 1, fontSize: 16 }]}>{fact ? L[lang].correction : L[lang].announcement}</Text>
                <Text style={T.muted} accessibilityLabel={clock(when)}>{ago(when, now) === "now" ? clock(when) : `${ago(when, now)} · ${clock(when)}`}</Text>
              </View>
              {fact && <Text style={[T.muted, { marginTop: 10 }]}>{L[lang].falseNote}</Text>}
              <Text style={styles.body}>{text(d, lang)}</Text>
              <View style={{ marginTop: 10, alignSelf: "flex-start" }}><HumanApprovedBadge /></View>
            </Card>
          );
        })}
      </View>
      <Text style={[T.muted, { marginTop: 18 }]}>
        Only trust updates shown here or from the organizers directly. Every update was approved by a person before it was sent.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconTile: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  body: { fontFamily: F.medium, fontSize: 17, lineHeight: 24, color: C.ink, marginTop: 8 },
});
