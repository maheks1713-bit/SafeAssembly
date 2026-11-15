// Screen 7: Rights Q&A, shared by organizer and marshal tabs.
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { C, F, S, T } from "@/lib/theme";
import { askRights } from "@/lib/api";
import { useTable } from "@/lib/store";
import { ErrorNote, RichText, Segmented, Tag, Thinking } from "./ui";
import type { RightsAnswer } from "@/lib/types";

type Lang = "en" | "fr";
type Msg = { id: number; role: "user"; text: string } | { id: number; role: "agent"; answer: RightsAnswer } | { id: number; role: "error"; text: string };

const SUGGESTED: Record<Lang, string[]> = {
  en: ["Do we need a permit?", "Can I film police?", "If I'm detained?", "Can police tell us to move?"],
  fr: ["Faut-il un permis ?", "Puis-je filmer la police ?", "Si je suis détenu ?", "La police peut-elle nous dire de partir ?"],
};
const L = {
  en: { eyebrow: "Rights Agent", title: "Know your rights", placeholder: "Ask about your rights...", loading: "Checking the rights guide...", legal: "Call your legal observer" },
  fr: { eyebrow: "Agent Droits", title: "Vos droits", placeholder: "Posez une question sur vos droits...", loading: "Consultation du guide des droits...", legal: "Appelez votre observateur juridique" },
};

export function RightsChat() {
  const [lang, setLang] = useState<Lang>("en");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const nextId = useRef(1);
  const legal = useTable("volunteers").find((v) => v.role === "legal_observer");

  async function ask(question: string, as: Lang = lang) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { id: nextId.current++, role: "user", text: q }]);
    setBusy(true);
    try {
      const answer = await askRights(q, as);
      setMsgs((m) => [...m, { id: nextId.current++, role: "agent", answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: nextId.current++, role: "error", text: (e as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  // Switching language re-asks the last question, so the same answer shows in EN and FR.
  function switchLang(l: Lang) {
    setLang(l);
    const last = [...msgs].reverse().find((m) => m.role === "user");
    if (last && last.role === "user") ask(last.text, l);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ground }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: S.pad, paddingBottom: 24 }} keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[T.muted, { fontSize: 15, fontFamily: F.semibold }]}>{L[lang].eyebrow}</Text>
              <Text style={[T.screenTitle, { marginTop: 4 }]} accessibilityRole="header">{L[lang].title}</Text>
            </View>
            <Segmented small value={lang} onChange={switchLang} options={[{ value: "en", label: "EN" }, { value: "fr", label: "FR" }]} />
          </View>

          <View style={styles.chips}>
            {SUGGESTED[lang].map((q) => (
              <Pressable key={q} onPress={() => ask(q)} style={styles.chip} accessibilityRole="button">
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </View>

          {msgs.map((m) =>
            m.role === "user" ? (
              <View key={m.id} style={styles.userBubble}><Text style={styles.userText}>{m.text}</Text></View>
            ) : m.role === "error" ? (
              <View key={m.id} style={{ marginBottom: 12 }}><ErrorNote message={m.text} /></View>
            ) : (
              <View key={m.id} style={{ marginBottom: 14, maxWidth: "88%" }}>
                <View style={styles.agentBubble}>
                  <RichText text={m.answer.answer} />
                  {m.answer.cited_sections.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {m.answer.cited_sections.map((c) => <Tag key={c} text={c} />)}
                    </View>
                  )}
                </View>
                <Text style={[T.muted, { marginTop: 6, marginLeft: 4 }]}>{m.answer.disclaimer}</Text>
              </View>
            ),
          )}
          {busy && <View style={{ marginBottom: 12 }}><Thinking label={L[lang].loading} /></View>}

          <Pressable style={styles.legal} accessibilityRole="button"
            onPress={() => Linking.openURL("tel:").catch(() => {})}>
            <Feather name="phone" size={20} color={C.teal} />
            <Text style={[T.cardTitle, { flex: 1, fontSize: 16 }]}>{L[lang].legal}</Text>
            <Text style={T.muted}>{legal?.callsign ?? "Legal-1"}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput value={input} onChangeText={setInput} placeholder={L[lang].placeholder} placeholderTextColor={C.muted}
            style={styles.input} returnKeyType="send" onSubmitEditing={() => ask(input)} editable={!busy} />
          <Pressable onPress={() => ask(input)} style={[styles.send, (!input.trim() || busy) && { opacity: 0.5 }]}
            accessibilityRole="button" accessibilityLabel="Send question" disabled={!input.trim() || busy}>
            <Feather name="arrow-right" size={22} color={C.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: { borderWidth: 1, borderColor: "#B8D8D4", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.white },
  chipText: { fontFamily: F.medium, fontSize: 15, color: C.teal },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.teal, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, maxWidth: "85%" },
  userText: { fontFamily: F.medium, fontSize: 16, color: C.white },
  agentBubble: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, borderTopLeftRadius: 4, padding: 16 },
  legal: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginTop: 8 },
  inputRow: { flexDirection: "row", gap: 10, paddingHorizontal: S.pad, paddingVertical: 10, alignItems: "center" },
  input: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, paddingHorizontal: 18, fontFamily: F.body, fontSize: 16, color: C.ink },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
});
