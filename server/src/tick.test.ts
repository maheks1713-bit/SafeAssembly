import { EVENT_ID } from "./test/env";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeDb, seedGolden, logTrail, nextTime, type FakeDb } from "./test/fakeDb";
import { runTick, tickState } from "./tick";
import { FACTS, POSTS } from "./golden";

let db: FakeDb;
beforeEach(() => { db = installFakeDb(); seedGolden(db, EVENT_ID, FACTS); });

const report = (zone_id: string, type: string, level: number | null = null, created_at = nextTime()) =>
  db.seed("reports", [{ event_id: EVENT_ID, zone_id, type, level, created_at }]);

test("golden path: crowd 5 at the exit runs Monitor then Dispatcher, in that order", async () => {
  report("barrington_exit", "crowd", 5);
  assert.deepEqual(await runTick(), { alerts: 1, posts: 0 });
  assert.deepEqual(logTrail(db), ["Monitor:alert", "Dispatcher:assign"]);
  assert.equal(db.rows("assignments").length, 3);
  assert.ok(tickState.lastTick);
  assert.deepEqual(tickState.lastResult, { alerts: 1, posts: 0 });
});

test("a second tick on the same data raises nothing new (the alert is already open)", async () => {
  report("barrington_exit", "crowd", 5);
  await runTick();
  assert.deepEqual(await runTick(), { alerts: 0, posts: 0 });
  assert.equal(db.rows("alerts").length, 1);
});

test("reports older than 10 minutes and other events' reports are ignored", async () => {
  report("stage", "medical", null, new Date(Date.now() - 11 * 60_000).toISOString());
  db.seed("reports", [{ event_id: "other-event", zone_id: "stage", type: "medical", level: null, created_at: nextTime() }]);
  assert.deepEqual(await runTick(), { alerts: 0, posts: 0 });
});

test("social posts are fact-checked once: marked processed before Comms runs", async () => {
  db.seed("signals", [{ event_id: EVENT_ID, source: "social", processed: false, payload_json: { ...POSTS["fake-cancel"], preset: "fake-cancel" } }]);
  assert.deepEqual(await runTick(), { alerts: 0, posts: 1 });
  assert.equal(db.rows("signals")[0].processed, true);
  assert.equal(db.rows("drafts")[0].kind, "correction");
  assert.deepEqual(await runTick(), { alerts: 0, posts: 0 }, "not checked again");
});

test("transit signals become a dispersal-risk alert; weather comes from the latest weather signal", async () => {
  db.seed("signals", [
    { event_id: EVENT_ID, source: "weather", processed: true, payload_json: { apparent_temperature: 5, wind_speed_10m: 10 } },
    { event_id: EVENT_ID, source: "weather", processed: true, payload_json: { apparent_temperature: -16, wind_speed_10m: 42 } },
    { event_id: EVENT_ID, source: "transit", processed: false, payload_json: { text: "Route 1 detour" } },
  ]);
  await runTick();
  const risks = db.rows("alerts").map((a) => a.risk_type).sort();
  assert.deepEqual(risks, ["cold_wind_stress", "dispersal_risk"]);
  assert.ok(db.rows("drafts").some((d) => d.kind === "announcement"), "warming tent announcement drafted");
});

test("a burst of ticks is coalesced: one running, at most one queued follow-up", async () => {
  report("barrington_exit", "crowd", 5);
  const results = await Promise.all([runTick(), runTick(), runTick(), runTick()]);
  assert.deepEqual(results[0], { alerts: 1, posts: 0 });
  assert.equal(results[1], results[3], "callers 2-4 share the same follow-up tick");
  assert.equal(db.rows("alerts").length, 1, "the same report never raises two alerts");
});

test("a database error fails the tick loudly", async () => {
  db.failNext("zones", "select", "network");
  await assert.rejects(runTick(), /zones: network/);
});
