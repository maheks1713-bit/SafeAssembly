// Participant tab 1: live crowd map, weather, why the event is happening, and when/where.
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ZoneMap } from "@/components/ZoneMap";
import { Button, Card, SectionLabel } from "@/components/ui";
import { C, F, T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { fmtTemp, latestWeather, type Weather } from "@/lib/format";
import { DEFAULT_CAUSE } from "@/lib/cause";

type FeatherName = keyof typeof Feather.glyphMap;
const isPlaceholder = (s?: string) => !s || /^\[.*\]$/.test(s.trim());

export default function EventInfo() {
  const event = useTable("events")[0];
  const zones = useTable("zones");
  const alerts = useTable("alerts");
  const reports = useTable("reports");
  const signals = useTable("signals");

  const facts = event?.facts_json ?? {};
  const cause = facts.cause ?? DEFAULT_CAUSE;
  const wx = latestWeather(signals);
  const ended = event?.status === "ended";
  const warming = facts.warming_tent;

  const details: [FeatherName, string, string | undefined][] = [
    ["calendar", "When", facts.time],
    ["map-pin", "Where", facts.place ?? event?.location],
    ["users", "Expected", facts.expected_size ?? (event?.expected_size ? `~${event.expected_size} people` : undefined)],
    ["star", "What happens", facts.activity],
    ["volume-2", "Sound", facts.amplified_sound],
    ["log-out", "Route and exits", facts.route],
    ["home", "Warming tent", warming],
    ["info", "Official updates", isPlaceholder(facts.official_updates) ? undefined : facts.official_updates],
  ];

  return (
    <Screen
      eyebrowNode={
        <View style={styles.topRow}>
          <View style={[styles.pill, ended && { backgroundColor: "#EEF0EE" }]}>
            <View style={[styles.dot, ended && { backgroundColor: C.muted }]} />
            <Text style={[styles.pillText, ended && { color: C.muted }]}>{ended ? "ENDED" : "HAPPENING NOW"}</Text>
          </View>
          {wx && (
            <View style={styles.wx} accessibilityLabel={`Weather ${wx.temp} degrees, feels like ${wx.feels}, wind ${wx.wind} kilometres per hour`}>
              <Feather name="thermometer" size={14} color={C.warningInk} />
              <Text style={styles.wxText}>{fmtTemp(wx.temp)}C, feels {fmtTemp(wx.feels)}</Text>
            </View>
          )}
        </View>
      }
      title={event?.name ?? "Halifax Climate Vigil"}>
      {ended && (
        <Card tone="teal" style={{ marginBottom: 14 }}>
          <Text style={[T.cardTitle, { fontSize: 17 }]}>This event has ended. Thank you for coming.</Text>
          <Text style={[T.body, { marginTop: 4, color: C.muted }]}>Please leave calmly and check in with the people you came with.</Text>
        </Card>
      )}

      <ZoneMap zones={zones} volunteers={[]} alerts={alerts} reports={reports} publicView />
      <Text style={[T.muted, { marginTop: 8 }]}>Tap an area to see how busy it is. Colours update live.</Text>

      {wx && <WeatherCard wx={wx} warming={warming} />}

      <SectionLabel style={{ marginTop: 24 }}>Why we are gathering</SectionLabel>
      <Card>
        <Text style={[T.body, { fontSize: 16, lineHeight: 23 }]}>{cause.about}</Text>
        {cause.why.map((w) => (
          <View key={w} style={styles.bullet}>
            <Feather name="check" size={16} color={C.teal} style={{ marginTop: 3 }} />
            <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{w}</Text>
          </View>
        ))}
      </Card>

      <SectionLabel style={{ marginTop: 24 }}>When and where</SectionLabel>
      <Card style={{ paddingVertical: 6 }}>
        {details.filter(([, , v]) => v).map(([icon, label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && styles.rowLine]}>
            <View style={styles.iconTile}><Feather name={icon} size={18} color={C.teal} /></View>
            <View style={{ flex: 1 }}>
              <Text style={T.muted}>{label}</Text>
              <Text style={[T.body, { fontSize: 15, fontFamily: F.medium }]}>{value}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionLabel style={{ marginTop: 24 }}>Stay safe</SectionLabel>
      <Card>
        <Text style={[T.body, { fontSize: 15 }]}>
          Need help or feel unwell? Ask any marshal or medic nearby. In an emergency, call 911. This is a peaceful event: if anyone
          pushes for trouble, step away and tell a marshal.
        </Text>
      </Card>

      <Button title="Switch role" variant="ghost" icon="log-out" style={{ marginTop: 24 }} onPress={() => router.replace("/")} />
    </Screen>
  );
}

function WeatherCard({ wx, warming }: { wx: Weather; warming?: string }) {
  const cold = wx.feels <= 0;
  const hot = wx.feels >= 28;
  const advice = cold
    ? `Dress warmly: hat, gloves and layers.${warming ? ` Warming tent: ${warming}.` : ""}`
    : hot ? "Bring water, wear a hat and rest in the shade." : "Comfortable conditions. Dress for the evening.";
  return (
    <Card tone={cold || hot ? "warning" : undefined} style={{ marginTop: 14, flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={[styles.iconTile, { backgroundColor: cold || hot ? C.warningBg : C.tint }]}>
        <Feather name={cold ? "cloud-snow" : hot ? "sun" : "cloud"} size={20} color={cold || hot ? C.warningInk : C.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.cardTitle, { fontSize: 16 }]}>{fmtTemp(wx.temp)}C, feels like {fmtTemp(wx.feels)} · wind {wx.wind} km/h</Text>
        <Text style={[T.body, { marginTop: 2, color: C.muted }]}>{advice}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.okBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok },
  pillText: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.6, color: C.ok },
  wx: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.warningBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  wxText: { fontFamily: F.semibold, fontSize: 12, color: C.warningInk },
  bullet: { flexDirection: "row", gap: 10, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
  iconTile: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
});
