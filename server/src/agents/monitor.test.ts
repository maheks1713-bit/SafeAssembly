import { EVENT_ID } from "../test/env";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeDb, seedGolden, logTrail, nextTime, ZONES, type FakeDb } from "../test/fakeDb";
import { monitorAgent } from "./monitor";

let db: FakeDb;
beforeEach(() => { db = installFakeDb(); seedGolden(db, EVENT_ID); });

const report = (zone_id: string, type: string, level: number | null = null) => ({ zone_id, type, level, created_at: nextTime() });

test("a crowd 5 at the exit creates an open severity 3 alert, explained from the golden cache, handed to Dispatcher", async () => {
  const [alert] = await monitorAgent([report("barrington_exit", "crowd", 5)], ZONES, null, [], []);
  assert.equal(alert.risk_type, "choke_point");
  assert.equal(db.rows("alerts").length, 1);
  assert.equal(db.rows("alerts")[0].event_id, EVENT_ID);
  assert.ok(alert.explanation.length > 0);

  const [log] = db.rows("agent_log");
  assert.equal(`${log.agent}:${log.action}`, "Monitor:alert");
  assert.equal(log.input_ref, alert.id);
  assert.equal(log.output_json.handoff, "Dispatcher");
  assert.equal(log.output_json.source, "cache");
  assert.match(log.output_json.why, /^Rule: crowd level 5/);
});

test("with no cached explanation, the rule's own facts become the explanation", async () => {
  const [alert] = await monitorAgent([report("stage", "crowd", 4)], ZONES, null, [], []);
  assert.equal(alert.risk_type, "overcrowding");
  assert.equal(alert.explanation, "Crowd level 4 reported in Stage.");
  assert.equal(db.rows("agent_log")[0].output_json.source, "rules");
});

test("a dispersal-risk note has no Dispatcher handoff", async () => {
  await monitorAgent([], ZONES, null, [{ text: "Route 1 detour", created_at: nextTime() }], []);
  assert.equal(db.rows("agent_log")[0].output_json.handoff, null);
});

test("quiet reports create nothing and log nothing", async () => {
  assert.deepEqual(await monitorAgent([report("stage", "crowd", 2)], ZONES, null, [], []), []);
  assert.deepEqual(logTrail(db), []);
});

test("a database failure on insert surfaces as an error (no silent loss of an alert)", async () => {
  db.failNext("alerts", "insert", "db down");
  await assert.rejects(monitorAgent([report("stage", "medical")], ZONES, null, [], []), /insert alert: db down/);
});
