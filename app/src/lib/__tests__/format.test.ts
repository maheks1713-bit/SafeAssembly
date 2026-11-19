import { alertTitle, ago, latestWeather, fmtTemp, zoneStatus, callsigns, joinList } from "../format";
import type { Alert, ReportRow, Signal, Volunteer } from "../types";

const alert = (p: Partial<Alert>): Alert => ({
  id: "a", event_id: "e", zone_id: "stage", risk_type: "medical", severity: 3, explanation: "", status: "open", created_at: "", ...p,
});
const crowd = (zone_id: ReportRow["zone_id"], level: number, minAgo = 1): ReportRow => ({
  id: "r", event_id: "e", zone_id, type: "crowd", level, note: null, created_at: new Date(Date.now() - minAgo * 60_000).toISOString(),
});

describe("alertTitle", () => {
  it("names the risk and the zone", () => {
    expect(alertTitle({ risk_type: "choke_point", zone_id: "barrington_exit" })).toBe("Choke point at Barrington Exit");
    expect(alertTitle({ risk_type: "cold_wind_stress", zone_id: "all" })).toBe("Cold stress, all zones");
  });
  it("falls back to raw ids it doesn't know", () => {
    expect(alertTitle({ risk_type: "new_risk", zone_id: "stage" })).toBe("new_risk at Stage");
  });
});

describe("ago", () => {
  const now = Date.parse("2026-11-15T20:00:00Z");
  const at = (s: number) => new Date(now - s * 1000).toISOString();
  it.each([
    [0, "now"], [44, "now"], [60, "1 min"], [59 * 60, "59 min"], [60 * 60, "1h 0m"], [95 * 60, "1h 35m"],
  ])("%i s ago -> %s", (s, label) => expect(ago(at(s), now)).toBe(label));
  it("never shows negative time for clock skew", () => expect(ago(at(-300), now)).toBe("now"));
});

describe("latestWeather / fmtTemp", () => {
  const sig = (source: Signal["source"], payload_json: Record<string, unknown>): Signal =>
    ({ id: "s", event_id: "e", source, payload_json, processed: true, created_at: "" });

  it("uses the first (newest) weather signal, rounded", () => {
    const w = latestWeather([
      sig("social", {}),
      sig("weather", { temperature_2m: -8.6, apparent_temperature: -15.5, wind_speed_10m: 41.6, forced: true }),
      sig("weather", { temperature_2m: 10, apparent_temperature: 10, wind_speed_10m: 0 }),
    ]);
    expect(w).toEqual({ temp: -9, feels: -15, wind: 42, forced: true });
  });
  it("is null with no weather yet", () => expect(latestWeather([sig("social", {})])).toBeNull());
  it("uses a real minus sign for negatives", () => {
    expect(fmtTemp(-16)).toBe("−16°");
    expect(fmtTemp(4)).toBe("4°");
    expect(fmtTemp(0)).toBe("0°");
  });
});

describe("zoneStatus (map colours)", () => {
  it("an open severity 3 alert makes the zone Critical", () => {
    expect(zoneStatus("stage", [alert({ severity: 3 })], [])).toBe("Critical");
  });
  it("an open severity 2 alert makes it Busy", () => {
    expect(zoneStatus("stage", [alert({ severity: 2 })], [])).toBe("Busy");
  });
  it("handled alerts and other zones' alerts don't count", () => {
    expect(zoneStatus("stage", [alert({ status: "handled" }), alert({ zone_id: "main_square" })], [])).toBe("OK");
  });
  it("a recent crowd report of 3+ makes it Busy; older than 15 minutes doesn't", () => {
    expect(zoneStatus("main_square", [], [crowd("main_square", 3)])).toBe("Busy");
    expect(zoneStatus("main_square", [], [crowd("main_square", 4, 16)])).toBe("OK");
    expect(zoneStatus("main_square", [], [crowd("main_square", 2)])).toBe("OK");
  });
  it("only the newest crowd report counts (rows are newest first)", () => {
    expect(zoneStatus("main_square", [], [crowd("main_square", 1), crowd("main_square", 5)])).toBe("OK");
  });
});

describe("callsigns / joinList", () => {
  const vols = [{ id: "1", callsign: "M2" }, { id: "2", callsign: "M5" }] as Volunteer[];
  it("maps ids to callsigns and drops unknown ids", () => {
    expect(callsigns(["1", "x", "2"], vols)).toEqual(["M2", "M5"]);
  });
  it("joins like a sentence", () => {
    expect(joinList([])).toBe("");
    expect(joinList(["M2"])).toBe("M2");
    expect(joinList(["M2", "M5"])).toBe("M2 and M5");
    expect(joinList(["M2", "M3", "M5"])).toBe("M2, M3 and M5");
  });
});
