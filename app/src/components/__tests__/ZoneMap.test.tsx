import { render, screen } from "@testing-library/react-native";
import { ZoneMap } from "../ZoneMap";
import { mockTables } from "@/lib/mocks";
import type { Alert } from "@/lib/types";

const t = mockTables();
const critical: Alert = {
  id: "x", event_id: t.zones[0].event_id, zone_id: "barrington_exit", risk_type: "choke_point", severity: 3,
  explanation: "", status: "open", created_at: new Date().toISOString(),
};

describe("ZoneMap", () => {
  it("organizers and marshals see volunteer pins, but never the legal observer", async () => {
    await render(<ZoneMap zones={t.zones} volunteers={t.volunteers} alerts={[]} reports={[]} />);
    expect(screen.getByLabelText(/^M4/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Legal-1/)).toBeNull();
  });

  it("participants see crowd colours only: no pins, so the public can't locate marshals", async () => {
    await render(<ZoneMap zones={t.zones} volunteers={t.volunteers} alerts={[]} reports={[]} publicView />);
    for (const v of t.volunteers) expect(screen.queryByLabelText(new RegExp(`^${v.callsign}`))).toBeNull();
    expect(screen.getByLabelText("Stage, OK")).toBeTruthy();
  });

  it("an open severity 3 alert turns the zone Critical", async () => {
    await render(<ZoneMap zones={t.zones} volunteers={[]} alerts={[critical]} reports={[]} publicView />);
    expect(screen.getByLabelText("Barrington Exit, Critical")).toBeTruthy();
    expect(screen.getByLabelText("Main Square, OK")).toBeTruthy();
  });

  it("assigned volunteers are labelled as assigned", async () => {
    const vols = t.volunteers.map((v) => (v.callsign === "M2" ? { ...v, status: "assigned" as const } : v));
    await render(<ZoneMap zones={t.zones} volunteers={vols} alerts={[]} reports={[]} />);
    expect(screen.getByLabelText("M2, assigned")).toBeTruthy();
  });
});
