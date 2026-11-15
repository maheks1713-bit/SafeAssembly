import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S, T } from "@/lib/theme";
import { refetchAll } from "@/lib/store";

export function Screen({ eyebrow, title, right, children, footer, scroll = true, eyebrowNode }: {
  eyebrow?: string; eyebrowNode?: ReactNode; title?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode; scroll?: boolean;
}) {
  const header = (title || eyebrow || eyebrowNode) && (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrowNode ?? (eyebrow ? <Text style={[T.muted, { fontSize: 15, fontFamily: "Inter_600SemiBold" }]}>{eyebrow}</Text> : null)}
        {title ? <Text style={[T.screenTitle, { marginTop: 4 }]} accessibilityRole="header">{title}</Text> : null}
      </View>
      {right}
    </View>
  );
  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={C.teal} />}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1, paddingBottom: 0 }]}>
          {header}
          {children}
        </View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ground },
  content: { padding: S.pad, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, marginBottom: 16 },
  footer: { flexDirection: "row", gap: S.gap, paddingHorizontal: S.pad, paddingVertical: 12, backgroundColor: C.ground },
});
