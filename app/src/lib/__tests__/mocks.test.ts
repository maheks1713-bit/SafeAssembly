// Demo-data mode must be internally consistent, or screens show broken references on stage.
import { MOCK_PLAN, mockTables, mockRights, mockReport, mockHealth } from "../mocks";
import { EVENT_ID } from "../config";

const t = mockTables();

describe("mock tables", () => {
  it("has the golden-path event, 3 zones and the seeded volunteers", () => {
    expect(t.events).toHaveLength(1);
    expect(t.zones.map((z) => z.id).sort()).toEqual(["barrington_exit", "main_square", "stage"]);
    expect(t.zones.filter((z) => z.has_exit).map((z) => z.id)).toEqual(["barrington_exit"]);
    expect(t.volunteers.find((v) => v.callsign === "M4")?.zone_id).toBe("barrington_exit");
  });

  it("every row belongs to the configured event", () => {
    for (const [name, rows] of Object.entries(t)) {
      if (name === "events") continue;
      for (const r of rows as { event_id: string }[]) expect(r.event_id).toBe(EVENT_ID);
    }
  });

  it("references resolve: volunteer zones, assignment volunteers and alerts", () => {
    const zones = new Set(t.zones.map((z) => z.id));
    const vols = new Set(t.volunteers.map((v) => v.id));
    const alerts = new Set(t.alerts.map((a) => a.id));
    for (const v of t.volunteers) if (v.zone_id) expect(zones.has(v.zone_id)).toBe(true);
    for (const a of t.assignments) {
      expect(vols.has(a.volunteer_id)).toBe(true);
      if (a.alert_id) expect(alerts.has(a.alert_id)).toBe(true);
    }
  });

  it("ids are unique within each table", () => {
    for (const rows of Object.values(t)) {
      const ids = (rows as { id: string }[]).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("returns fresh copies, so a Reset demo really resets", () => {
    const a = mockTables();
    a.drafts[0].status = "rejected";
    expect(mockTables().drafts[0].status).not.toBe("rejected");
  });
});

describe("mock agent answers", () => {
  it("plan keeps the HRM disclaimer and a sane checklist", () => {
    expect(MOCK_PLAN.disclaimer).toMatch(/Verify with HRM/);
    expect(MOCK_PLAN.checklist.length).toBeGreaterThan(0);
    for (const c of MOCK_PLAN.checklist) expect(typeof c.done).toBe("boolean");
  });

  it("rights answers always carry the disclaimer in the asked language", () => {
    expect(mockRights("Can I film police?", "en").disclaimer).toBe("General information, not legal advice.");
    expect(mockRights("Can I film police?", "en").answer).toMatch(/filming/i);
    expect(mockRights("Puis-je filmer ?", "fr").disclaimer).toBe("Information générale, pas un avis juridique.");
  });

  it("report and health have the shapes the screens expect", () => {
    expect(Object.keys(mockReport().stats).sort()).toEqual(["alerts", "calls_911", "corrections", "people_moved"]);
    expect(mockHealth()).toMatchObject({ ok: true, gemini: "cache-only", event_id: EVENT_ID });
  });
});
