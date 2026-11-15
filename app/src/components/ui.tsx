import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, S, T, SEVERITY_STYLE, severityWord, type SeverityWord } from "@/lib/theme";

type FeatherName = keyof typeof Feather.glyphMap;

// ---------- Button (min 44 px; marshal 56+) ----------
type Variant = "primary" | "secondary" | "danger" | "dark" | "mint" | "ghost";
export function Button({
  title, onPress, variant = "primary", icon, loading, disabled, big, style, textStyle,
}: {
  title: string; onPress?: () => void; variant?: Variant; icon?: FeatherName; loading?: boolean; disabled?: boolean;
  big?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn, { backgroundColor: v.bg, borderColor: v.border, minHeight: big ? S.marshalBtn : S.btn },
        (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style,
      ]}>
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Feather name={icon} size={big ? 22 : 18} color={v.fg} /> : null}
      <Text style={[styles.btnText, { color: v.fg, fontSize: big ? 20 : 16 }, textStyle]}>{title}</Text>
    </Pressable>
  );
}
const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.teal, fg: C.white, border: C.teal },
  secondary: { bg: C.white, fg: C.teal, border: C.teal },
  danger: { bg: C.critical, fg: C.white, border: C.critical },
  dark: { bg: C.deepTeal, fg: C.white, border: C.deepTeal },
  mint: { bg: C.mint, fg: C.deepTeal, border: C.mint },
  ghost: { bg: C.white, fg: C.ink, border: C.line },
};

// ---------- Card ----------
export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "critical" | "warning" | "teal" }) {
  const border = tone === "critical" ? "#F2C4BE" : tone === "warning" ? "#F1DCA8" : tone === "teal" ? C.teal : C.line;
  return <View style={[styles.card, { borderColor: border, borderWidth: tone === "teal" ? 2 : 1 }, style]}>{children}</View>;
}

// ---------- Chips & badges ----------
export function SeverityChip({ severity, word }: { severity?: number; word?: SeverityWord }) {
  const w = word ?? severityWord(severity ?? 1);
  const s = SEVERITY_STYLE[w];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Text style={[styles.chipText, { color: s.fg }]}>{w}</Text>
    </View>
  );
}

export function Tag({ text, bg = C.tint, fg = C.teal, style }: { text: string; bg?: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }, style]}>
      <Text style={[styles.tagText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function HumanApprovedBadge() {
  return (
    <View style={[styles.tag, { backgroundColor: C.okBg, flexDirection: "row", gap: 4, alignItems: "center" }]}>
      <Feather name="check" size={13} color={C.ok} />
      <Text style={[styles.tagText, { color: C.ok }]}>Human approved</Text>
    </View>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[T.label, { marginTop: 20, marginBottom: 10 }, style]}>{children}</Text>;
}

// ---------- Segmented control (EN/FR, Permit/Checklist/Route) ----------
export function Segmented<V extends string>({
  options, value, onChange, small,
}: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; small?: boolean }) {
  return (
    <View style={[styles.seg, small && { padding: 3 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
            style={[styles.segItem, small && { paddingHorizontal: 12, minHeight: 32 }, on && (small ? { backgroundColor: C.teal } : styles.segOn)]}>
            <Text style={[styles.segText, small && { fontSize: 14 }, on && { color: small ? C.white : C.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- **bold** text from agent output ----------
export function RichText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <View style={{ gap: 10 }}>
      {paragraphs.map((p, i) => (
        <Text key={i} style={[T.body, { fontSize: 16, lineHeight: 23 }, style]}>
          {p.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") ? <Text key={j} style={{ fontFamily: F.bold }}>{part.slice(2, -2)}</Text> : part)}
        </Text>
      ))}
    </View>
  );
}

// ---------- Loading state: never a bare spinner, always say which agent is doing what ----------
export function Thinking({ label, dark }: { label: string; dark?: boolean }) {
  const [a] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  useEffect(() => {
    const loop = Animated.loop(Animated.stagger(180, a.map((v) =>
      Animated.sequence([Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }), Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true })]))));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View style={[styles.thinking, dark && { backgroundColor: C.nightCard, borderColor: C.nightLine }]} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", gap: 5 }}>
        {a.map((v, i) => <Animated.View key={i} style={[styles.dot, { opacity: v, backgroundColor: i === 0 ? C.teal : i === 1 ? "#5FA8A2" : "#A9D3CF" }]} />)}
      </View>
      <Text style={[T.muted, { fontSize: 15 }, dark && { color: "#B9C6C3" }]}>{label}</Text>
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Feather name="alert-circle" size={16} color={C.critical} />
      <Text style={[T.body, { color: C.critical, flex: 1 }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16 },
  btnText: { fontFamily: F.bold },
  card: { backgroundColor: C.white, borderRadius: S.radius, padding: S.pad },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  chipText: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.5 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: "flex-start" },
  tagText: { fontFamily: F.bold, fontSize: 13 },
  seg: { flexDirection: "row", backgroundColor: "#E6E9E6", borderRadius: 12, padding: 4 },
  segItem: { flex: 0, flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: 40, borderRadius: 9, paddingHorizontal: 8 },
  segOn: { backgroundColor: C.white, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontFamily: F.semibold, fontSize: 15, color: C.muted },
  thinking: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "flex-start" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  error: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: C.criticalBg, borderRadius: 12, padding: 12 },
});
