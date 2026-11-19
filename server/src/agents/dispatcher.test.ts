import { EVENT_ID } from "../test/env";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeDb, seedGolden, logTrail, VOLUNTEERS, type FakeDb } from "../test/fakeDb";
import { dispatcherAgent } from "./dispatcher";
import { setGeminiClientForTests } from "../gemini";
import { env } from "../env";
import type { AlertRow } from "./monitor";
import type { Volunteer } from "../rules";

let db: FakeDb;
let vols: Volunteer[];
beforeEach(() => {
  db = installFakeDb();
  seedGolden(db, EVENT_ID);
  vols = VOLUNTEERS.map((v) => ({ ...v }));
});
afterEach(() => {
  Object.assign(env, { geminiKey: "", modelFast: "", modelSmart: "" });
  setGeminiClientForTests(null);
});

const alert = (zone_id: string, risk_type: string, severity: number): AlertRow =>
  ({ id: `a-${risk_type}`, zone_id, risk_type, severity, explanation: "Because.", status: "open", created_at: "" });
const byCallsign = (db: FakeDb) => {
  const name = (id: string) => VOLUNTEERS.find((v) => v.id === id)!.callsign;
  return Object.fromEntries(db.rows("assignments").map((a) => [name(a.volunteer_id), a]));
};

test("choke point: M2 and M5 move to the exit, M4 holds, and the volunteer rows are updated", async () => {
  await dispatcherAgent(alert("barrington_exit", "choke_point", 3), vols);
  const a = byCallsign(db);
  assert.deepEqual(Object.keys(a).sort(), ["M2", "M4", "M5"]);
  assert.deepEqual([a.M2.kind, a.M5.kind, a.M4.kind], ["move", "move", "hold"]);
  for (const x of Object.values(a)) {
    assert.equal(x.zone_id, "barrington_exit");
    assert.equal(x.alert_id, "a-choke_point");
    assert.ok(x.instruction.length > 0);
  }

  const vrow = (c: string) => db.rows("volunteers").find((v) => v.callsign === c)!;
  assert.deepEqual([vrow("M2").status, vrow("M2").zone_id], ["assigned", "barrington_exit"]);
  assert.deepEqual([vrow("M4").status, vrow("M4").zone_id], ["assigned", "barrington_exit"]);
  assert.equal(vols.find((v) => v.callsign === "M5")!.status, "assigned", "in-memory list updated for the next alert in the same tick");

  assert.deepEqual(logTrail(db), ["Dispatcher:assign"]);
  assert.equal(db.rows("agent_log")[0].summary, "Sent M2 and M5 to Barrington Exit. M4 holds the line.");
  assert.equal(db.rows("drafts").length, 0, "no 911 for a choke point");
});

test("medical at Stage: sends Medic-1 and drafts a 911 escalation for a human to decide", async () => {
  await dispatcherAgent(alert("stage", "medical", 3), vols);
  assert.deepEqual(Object.keys(byCallsign(db)), ["Medic-1"]);
  const [draft] = db.rows("drafts");
  assert.equal(draft.kind, "escalation_911");
  assert.equal(draft.meta.priority, "high");
  assert.ok(draft.body_en.length > 0);
  assert.deepEqual(logTrail(db), ["Dispatcher:assign", "Dispatcher:escalation_draft"]);
});

test("cold stress: a medic goes to the warming tent at Stage and a bilingual announcement is drafted", async () => {
  vols = vols.map((v) => (v.callsign === "Medic-1" ? { ...v, status: "assigned" } : v));
  await dispatcherAgent(alert("all", "cold_wind_stress", 2), vols);
  const a = byCallsign(db);
  assert.deepEqual(Object.keys(a), ["Medic-2"]);
  assert.equal(a["Medic-2"].zone_id, "stage");
  const [draft] = db.rows("drafts");
  assert.equal(draft.kind, "announcement");
  assert.ok(draft.body_en && draft.body_fr);
});

test("no free volunteer: nothing is assigned and the organizer is told to reassign", async () => {
  // Everyone busy at Stage, nobody standing in Main Square to hold the line either.
  vols = vols.map((v) => ({ ...v, status: "assigned", zone_id: "stage" }));
  await dispatcherAgent(alert("main_square", "overcrowding", 2), vols);
  assert.equal(db.rows("assignments").length, 0);
  assert.deepEqual(logTrail(db), ["Dispatcher:no_volunteer"]);
  assert.match(db.rows("agent_log")[0].summary, /No free marshal available/);
});

test("dispersal risk is informational: no assignments, no log", async () => {
  await dispatcherAgent(alert("barrington_exit", "dispersal_risk", 1), vols);
  assert.deepEqual([db.rows("assignments").length, logTrail(db).length], [0, 0]);
});

test("code decides who: callsigns invented by the model are ignored, missing ones get the template", async () => {
  Object.assign(env, { geminiKey: "k", modelFast: "f", modelSmart: "s" });
  setGeminiClientForTests({
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          assignments: [{ callsign: "M3", instruction: "Model words for M3" }, { callsign: "X9", instruction: "Invented person" }],
          reason: "r", escalate_reason: "", announcement_en: "", announcement_fr: "",
        }),
      }),
    },
  });
  await dispatcherAgent(alert("main_square", "overcrowding", 2), vols);
  const a = byCallsign(db);
  assert.equal(db.rows("assignments").length, 4, "M3 sent + M1, M2, M5 hold; nobody called X9");
  assert.equal(a.M3.instruction, "Model words for M3");
  assert.match(a.M2.instruction, /hold the line/, "template used where the model gave no instruction");
  assert.equal(db.rows("agent_log")[0].output_json.source, "gemini");
});

test("a marshal already in the alert zone holds instead of being sent", async () => {
  await dispatcherAgent(alert("main_square", "overcrowding", 2), vols);
  const a = byCallsign(db);
  for (const c of ["M1", "M2", "M5"]) assert.equal(a[c]?.kind, "hold", c);
  assert.equal(a.M3.kind, "move", "nearest free marshal from an adjacent zone");
});
