import { test } from "node:test";
import assert from "node:assert/strict";
import { monitorRules, pickVolunteers, holders, needs911, targetZone, dedupe, NEED, ADJ, type Volunteer, type Zone } from "./rules";

const zones: Zone[] = [
  { id: "stage", name: "Stage", has_exit: false },
  { id: "main_square", name: "Main Square", has_exit: false },
  { id: "barrington_exit", name: "Barrington Exit", has_exit: true },
];
const T = "2026-11-15T19:11:00Z";
const r = (zone_id: string, type: string, level: number | null = null) => ({ zone_id, type, level, created_at: T });

test("crowd level 4+ at an exit zone is a severity 3 choke point", () => {
  const a = monitorRules([r("barrington_exit", "crowd", 5)], zones, null, [], []);
  assert.deepEqual(a.map((x) => [x.zone_id, x.risk_type, x.severity]), [["barrington_exit", "choke_point", 3]]);
});

test("crowd level 4+ elsewhere is overcrowding severity 2; level 3 is nothing", () => {
  const a = monitorRules([r("main_square", "crowd", 4), r("stage", "crowd", 3)], zones, null, [], []);
  assert.deepEqual(a.map((x) => [x.zone_id, x.risk_type, x.severity]), [["main_square", "overcrowding", 2]]);
});

test("medical and blocked exit are severity 3", () => {
  const a = monitorRules([r("stage", "medical"), r("barrington_exit", "blocked_exit")], zones, null, [], []);
  assert.deepEqual(a.map((x) => [x.risk_type, x.severity]), [["medical", 3], ["blocked_exit", 3]]);
});

test("cold below -10 or wind above 50 is cold stress; above 30 is heat stress", () => {
  assert.equal(monitorRules([], zones, { apparent_temperature: -16, wind_speed_10m: 42, created_at: T }, [], [])[0].risk_type, "cold_wind_stress");
  assert.equal(monitorRules([], zones, { apparent_temperature: 2, wind_speed_10m: 55, created_at: T }, [], [])[0].risk_type, "cold_wind_stress");
  assert.equal(monitorRules([], zones, { apparent_temperature: 31, wind_speed_10m: 5, created_at: T }, [], [])[0].risk_type, "heat_stress");
  assert.equal(monitorRules([], zones, { apparent_temperature: -5, wind_speed_10m: 20, created_at: T }, [], []).length, 0);
});

test("transit signal is dispersal risk severity 1", () => {
  const a = monitorRules([], zones, null, [{ text: "Route 1 detour", created_at: T }], []);
  assert.deepEqual(a.map((x) => [x.zone_id, x.risk_type, x.severity]), [["barrington_exit", "dispersal_risk", 1]]);
});

test("dedupe: skip if an open alert exists, or one was raised after the evidence", () => {
  const rep = [r("barrington_exit", "crowd", 5), r("barrington_exit", "crowd", 5)];
  assert.equal(monitorRules(rep, zones, null, [], []).length, 1, "duplicate in same batch");
  const open = [{ zone_id: "barrington_exit", risk_type: "choke_point", status: "open", created_at: "2026-11-15T19:00:00Z" }];
  assert.equal(monitorRules(rep, zones, null, [], open).length, 0, "already open");
  const handledLater = [{ zone_id: "barrington_exit", risk_type: "choke_point", status: "handled", created_at: "2026-11-15T19:12:00Z" }];
  assert.equal(monitorRules(rep, zones, null, [], handledLater).length, 0, "handled after this report");
  const handledEarlier = [{ zone_id: "barrington_exit", risk_type: "choke_point", status: "handled", created_at: "2026-11-15T19:00:00Z" }];
  assert.equal(monitorRules(rep, zones, null, [], handledEarlier).length, 1, "new report after handled alert");
});

const vols: Volunteer[] = [
  { id: "1", callsign: "M1", role: "marshal", zone_id: "main_square", status: "free" },
  { id: "2", callsign: "M2", role: "marshal", zone_id: "main_square", status: "free" },
  { id: "3", callsign: "M3", role: "marshal", zone_id: "stage", status: "free" },
  { id: "4", callsign: "M4", role: "marshal", zone_id: "barrington_exit", status: "free" },
  { id: "5", callsign: "M5", role: "marshal", zone_id: "main_square", status: "free" },
  { id: "6", callsign: "M6", role: "marshal", zone_id: "stage", status: "free" },
  { id: "7", callsign: "Medic-1", role: "medic", zone_id: "stage", status: "free" },
  { id: "8", callsign: "Medic-2", role: "medic", zone_id: "main_square", status: "free" },
];

test("choke point at Barrington Exit: M4 holds, two nearest free marshals from Main Square are sent", () => {
  const alert = { zone_id: "barrington_exit", risk_type: "choke_point", severity: 3 };
  // Seed marks M1 busy (info table), so this matches the UI design: "Dispatcher sent M2, M5".
  const seeded = vols.map((v) => (v.callsign === "M1" ? { ...v, status: "busy" } : v));
  assert.deepEqual(pickVolunteers(seeded, alert).map((v) => v.callsign), ["M2", "M5"]);
  assert.deepEqual(holders(vols, alert).map((v) => v.callsign), ["M4"]);
});

test("assigned volunteers are not picked again", () => {
  const busy = vols.map((v) => (v.callsign === "M1" || v.callsign === "M2" ? { ...v, status: "assigned" } : v));
  const sent = pickVolunteers(busy, { zone_id: "barrington_exit", risk_type: "choke_point", severity: 3 }).map((v) => v.callsign);
  assert.deepEqual(sent, ["M5", "M3"]);
});

test("medical at Stage sends the medic already at Stage; cold stress sends a medic to Stage", () => {
  assert.deepEqual(pickVolunteers(vols, { zone_id: "stage", risk_type: "medical", severity: 3 }).map((v) => v.callsign), ["Medic-1"]);
  assert.deepEqual(pickVolunteers(vols, { zone_id: "all", risk_type: "cold_wind_stress", severity: 2 }).map((v) => v.callsign), ["Medic-1"]);
});

test("911 escalation only for severity 3 medical or blocked exit", () => {
  assert.equal(needs911({ zone_id: "stage", risk_type: "medical", severity: 3 }), true);
  assert.equal(needs911({ zone_id: "barrington_exit", risk_type: "blocked_exit", severity: 3 }), true);
  assert.equal(needs911({ zone_id: "barrington_exit", risk_type: "choke_point", severity: 3 }), false);
});

// ---- Edge cases ----

test("reports for unknown zones and non-alerting report types are ignored", () => {
  assert.equal(monitorRules([r("parking_lot", "crowd", 5), r("stage", "note")], zones, null, [], []).length, 0);
});

test("a crowd report with no level never raises an alert", () => {
  assert.equal(monitorRules([r("barrington_exit", "crowd", null)], zones, null, [], []).length, 0);
});

test("weather boundaries: exactly -10 °C and exactly 50 km/h are not alerts; 30 °C is not heat stress", () => {
  assert.equal(monitorRules([], zones, { apparent_temperature: -10, wind_speed_10m: 50, created_at: T }, [], []).length, 0);
  assert.equal(monitorRules([], zones, { apparent_temperature: 30, wind_speed_10m: 0, created_at: T }, [], []).length, 0);
});

test("weather alerts are event-wide and handled at the warming tent at Stage", () => {
  const [a] = monitorRules([], zones, { apparent_temperature: -20, wind_speed_10m: 0, created_at: T }, [], []);
  assert.equal(a.zone_id, "all");
  assert.equal(targetZone(a), "stage");
  assert.equal(targetZone({ zone_id: "main_square", risk_type: "x", severity: 1 }), "main_square");
});

test("dedupe keeps different risks in the same zone, and the same risk in different zones", () => {
  const raw = [
    { zone_id: "stage", risk_type: "medical", severity: 3 as const, facts: "", since: T },
    { zone_id: "stage", risk_type: "overcrowding", severity: 2 as const, facts: "", since: T },
    { zone_id: "main_square", risk_type: "medical", severity: 3 as const, facts: "", since: T },
  ];
  assert.equal(dedupe(raw, []).length, 3);
});

test("every alert type that needs people has a staffing rule; dispersal risk needs none", () => {
  for (const k of ["choke_point", "overcrowding", "medical", "blocked_exit", "cold_wind_stress", "heat_stress"]) assert.ok(NEED[k], k);
  assert.equal(NEED.dispersal_risk, undefined);
  assert.deepEqual(pickVolunteers(vols, { zone_id: "barrington_exit", risk_type: "dispersal_risk", severity: 1 }), []);
});

test("zone adjacency is symmetric", () => {
  for (const [z, ns] of Object.entries(ADJ)) for (const n of ns) assert.ok(ADJ[n].includes(z), `${z} <-> ${n}`);
});

test("legal observers and busy volunteers are never dispatched", () => {
  const withLegal: Volunteer[] = [...vols, { id: "9", callsign: "Legal-1", role: "legal_observer", zone_id: "stage", status: "free" }];
  for (const risk of Object.keys(NEED)) {
    const sent = pickVolunteers(withLegal, { zone_id: "stage", risk_type: risk, severity: 3 });
    assert.ok(!sent.some((v) => v.role === "legal_observer"), risk);
  }
  const allBusy = vols.map((v) => ({ ...v, status: "busy" }));
  assert.deepEqual(pickVolunteers(allBusy, { zone_id: "stage", risk_type: "medical", severity: 3 }), []);
});

test("ties in distance are broken by callsign, so dispatch is deterministic", () => {
  const sent = pickVolunteers(vols, { zone_id: "stage", risk_type: "blocked_exit", severity: 3 }).map((v) => v.callsign);
  assert.deepEqual(sent, ["M1", "M2"], "Stage marshals hold; nearest are Main Square's, alphabetically");
});

test("holders apply only to crowd and exit risks", () => {
  assert.deepEqual(holders(vols, { zone_id: "stage", risk_type: "medical", severity: 3 }), []);
  assert.deepEqual(holders(vols, { zone_id: "stage", risk_type: "overcrowding", severity: 2 }).map((v) => v.callsign), ["M3", "M6"]);
});

test("911 is never suggested below severity 3, even for medical", () => {
  assert.equal(needs911({ zone_id: "stage", risk_type: "medical", severity: 2 }), false);
  assert.equal(needs911({ zone_id: "all", risk_type: "cold_wind_stress", severity: 3 }), false);
});
