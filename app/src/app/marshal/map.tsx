// Marshal map: same live zone map the organizer sees, with this marshal's zone highlighted.
import { Text } from "react-native";
import { Screen } from "@/components/Screen";
import { ZoneMap } from "@/components/ZoneMap";
import { Card } from "@/components/ui";
import { T } from "@/lib/theme";
import { useTable } from "@/lib/store";
import { useMe } from "@/lib/useMe";
import { alertTitle, ZONE_NAME } from "@/lib/format";

export default function MarshalMap() {
  const { me, volunteers } = useMe();
  const zones = useTable("zones");
  const alerts = useTable("alerts");
  const reports = useTable("reports");
  const open = alerts.filter((a) => a.status === "open");

  return (
    <Screen eyebrow={me ? `You are ${me.callsign} · ${ZONE_NAME[me.zone_id ?? ""] ?? ""}` : undefined} title="Live map">
      <ZoneMap zones={zones} volunteers={volunteers} alerts={alerts} reports={reports} highlight={me?.zone_id ?? undefined} />
      <Card style={{ marginTop: 14 }}>
        <Text style={[T.cardTitle, { marginBottom: 6 }]}>Open alerts</Text>
        {open.length === 0
          ? <Text style={T.body}>All clear.</Text>
          : open.map((a) => <Text key={a.id} style={[T.body, { fontSize: 15, paddingVertical: 3 }]}>• {alertTitle(a)}</Text>)}
      </Card>
    </Screen>
  );
}
