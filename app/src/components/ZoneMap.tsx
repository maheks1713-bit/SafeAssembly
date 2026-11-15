// Stylised Grand Parade map: 3 tappable zones coloured OK / Busy / Critical, plus volunteer pins.
// (Plan's map fallback: no react-native-maps, matches the UI design, works in Expo Go everywhere.)
import { Alert as RNAlert, Pressable, StyleSheet, Text, View } from "react-native";
import { C, F } from "@/lib/theme";
import { zoneStatus, joinList, type ZoneStatus } from "@/lib/format";
import type { Alert, ReportRow, Volunteer, Zone } from "@/lib/types";

const STATUS: Record<ZoneStatus, { fill: string; border: string; text: string }> = {
  OK: { fill: "rgba(30,122,70,0.16)", border: C.ok, text: C.ok },
  Busy: { fill: "rgba(201,138,18,0.24)", border: C.warning, text: C.warningInk },
  Critical: { fill: "rgba(180,35,24,0.20)", border: C.critical, text: C.white },
};
const PIN = 34;

export function ZoneMap({ zones, volunteers, alerts, reports, highlight }: {
  zones: Zone[]; volunteers: Volunteer[]; alerts: Alert[]; reports: ReportRow[]; highlight?: string;
}) {
  const ordered = [...zones].sort((a, b) => (a.id === "barrington_exit" ? 1 : b.id === "barrington_exit" ? -1 : 0));
  const pins = volunteers.filter((v) => v.role !== "legal_observer" && v.zone_id);

  return (
    <View style={styles.card}>
      <View style={styles.map} accessibilityLabel="Map of Grand Parade">
        {/* streets */}
        <View style={[styles.street, { right: "4%", top: 0, bottom: "9%", width: "8%" }]}>
          <Text style={styles.streetV}>Barrington St</Text>
        </View>
        <View style={[styles.street, { left: 0, right: 0, bottom: 0, height: "9%", justifyContent: "center" }]}>
          <Text style={[styles.streetText, { marginLeft: "9%" }]}>George St</Text>
        </View>
        <View style={[styles.street, { left: "3%", top: 0, bottom: "9%", width: "3%" }]} />

        {ordered.map((z) => {
          const box = z.polygon_json?.box;
          if (!box) return null;
          const st = zoneStatus(z.id, alerts, reports);
          const s = STATUS[st];
          const here = pins.filter((v) => v.zone_id === z.id).map((v) => v.callsign);
          return (
            <Pressable
              key={z.id}
              accessibilityRole="button"
              accessibilityLabel={`${z.name}, ${st}`}
              onPress={() => RNAlert.alert(`${z.name} · ${st}`, here.length ? `Volunteers here: ${joinList(here)}` : "No volunteers here right now.")}
              style={[styles.zone, {
                left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`,
                backgroundColor: s.fill, borderColor: s.border, borderWidth: highlight === z.id ? 3 : 2,
              }]}>
              <View style={[styles.zoneLabel, st === "Critical" ? { backgroundColor: C.critical } : { backgroundColor: C.white },
                z.id === "barrington_exit" && { position: "absolute", top: -4, right: "40%", minWidth: 128 }]}>
                <Text style={[styles.zoneLabelText, { color: s.text }]} numberOfLines={1}>
                  {z.name}{z.id === "barrington_exit" && st === "Critical" ? "" : ` · ${st}`}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {ordered.map((z) => {
          const box = z.polygon_json?.box;
          if (!box) return null;
          const here = pins.filter((v) => v.zone_id === z.id);
          const tall = box.h > box.w * 1.3;
          return here.map((v, i) => {
            const t = (i + 1) / (here.length + 1);
            const x = tall ? box.x + box.w * 0.5 : box.x + box.w * (0.15 + 0.75 * t);
            const y = tall ? box.y + box.h * (0.2 + 0.75 * t) : box.y + box.h * (z.id === "stage" ? 0.68 : 0.62);
            const medic = v.role === "medic";
            const moving = v.status === "assigned";
            return (
              <View key={v.id} accessibilityLabel={`${v.callsign}${moving ? ", assigned" : ""}`}
                style={[styles.pin, { left: `${x}%`, top: `${y}%` },
                  medic ? { backgroundColor: C.white, borderColor: C.critical } : { backgroundColor: moving ? C.teal : C.ink }]}>
                {medic
                  ? <Text style={[styles.pinText, { color: C.critical, fontSize: 18 }]}>+</Text>
                  : <Text style={styles.pinText}>{v.callsign}</Text>}
              </View>
            );
          });
        })}
      </View>

      <View style={styles.legend}>
        {(["OK", "Busy", "Critical"] as ZoneStatus[]).map((k) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.sq, { backgroundColor: k === "OK" ? C.ok : k === "Busy" ? C.warning : C.critical }]} />
            <Text style={styles.legendText}>{k}</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={styles.legendItem}>
          <View style={[styles.sq, { backgroundColor: C.teal, borderRadius: 7 }]} />
          <Text style={styles.legendText}>Moving</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12 },
  map: { aspectRatio: 1.32, backgroundColor: "#ECEFEC", borderRadius: 10, overflow: "hidden" },
  street: { position: "absolute", backgroundColor: C.white },
  streetText: { fontFamily: F.semibold, fontSize: 11, color: C.muted },
  streetV: { position: "absolute", top: "45%", left: -40, width: 110, fontFamily: F.semibold, fontSize: 11, color: C.muted, transform: [{ rotate: "90deg" }], textAlign: "center" },
  zone: { position: "absolute", borderRadius: 8, padding: 6 },
  zoneLabel: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  zoneLabelText: { fontFamily: F.bold, fontSize: 12 },
  pin: { position: "absolute", width: PIN, height: PIN, marginLeft: -PIN / 2, marginTop: -PIN / 2, borderRadius: PIN / 2, borderWidth: 2, borderColor: C.white, alignItems: "center", justifyContent: "center" },
  pinText: { fontFamily: F.bold, fontSize: 11, color: C.white },
  legend: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10, paddingHorizontal: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  sq: { width: 13, height: 13, borderRadius: 3 },
  legendText: { fontFamily: F.body, fontSize: 13, color: C.ink },
});
