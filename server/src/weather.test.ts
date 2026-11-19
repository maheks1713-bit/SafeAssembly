import { EVENT_ID } from "./test/env";
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { installFakeDb, seedGolden, type FakeDb } from "./test/fakeDb";
import { forceColdSnap, pollWeather } from "./weather";
import { resetDemo } from "./seed";
import { logAgent } from "./log";
import { FACTS } from "./golden";

let db: FakeDb;
beforeEach(() => { db = installFakeDb(); seedGolden(db, EVENT_ID, FACTS); });
afterEach(() => mock.restoreAll());

const fakeFetch = (current: Record<string, number>, ok = true) =>
  mock.method(globalThis, "fetch", async () => ({ ok, status: ok ? 200 : 503, json: async () => ({ current }) }) as Response);

// ---- Weather ----

test("forced cold snap: -16 °C feels-like, flagged as forced", async () => {
  await forceColdSnap();
  const [s] = db.rows("signals");
  assert.deepEqual([s.source, s.payload_json.apparent_temperature, s.payload_json.forced, s.processed], ["weather", -16, true, true]);
});

test("polling stores Open-Meteo's current weather for Grand Parade, then runs the agents", async () => {
  const f = fakeFetch({ temperature_2m: 30, apparent_temperature: 34, wind_speed_10m: 5 });
  await pollWeather();
  assert.match(String(f.mock.calls[0].arguments[0]), /api\.open-meteo\.com.*latitude=44\.65&longitude=-63\.57/);
  assert.equal(db.rows("signals")[0].payload_json.apparent_temperature, 34);
  assert.equal(db.rows("alerts")[0].risk_type, "heat_stress", "the tick saw the new reading");
});

test("a forced cold snap from the last hour wins: real weather is not fetched", async () => {
  await forceColdSnap();
  const f = fakeFetch({ apparent_temperature: 20, wind_speed_10m: 0 });
  await pollWeather();
  assert.equal(f.mock.callCount(), 0);
  assert.equal(db.rows("signals").length, 1);
});

test("an old forced snap no longer blocks polling", async () => {
  db.seed("signals", [{ event_id: EVENT_ID, source: "weather", processed: true, created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), payload_json: { forced: true } }]);
  const f = fakeFetch({ apparent_temperature: 5, wind_speed_10m: 5 });
  await pollWeather();
  assert.equal(f.mock.callCount(), 1);
});

test("an Open-Meteo outage throws and stores nothing", async () => {
  fakeFetch({}, false);
  await assert.rejects(pollWeather(), /Open-Meteo 503/);
  assert.equal(db.rows("signals").length, 0);
});

// ---- Reset demo ----

test("reset demo clears live data, re-seeds 3 zones and 9 volunteers, and keeps an existing plan", async () => {
  db.rows("events")[0].facts_json = { ...FACTS, place: "Edited", plan: { submitted: true } };
  db.seed("alerts", [{ event_id: EVENT_ID, risk_type: "medical" }, { event_id: "other", risk_type: "medical" }]);
  db.seed("agent_log", [{ event_id: EVENT_ID, agent: "Monitor" }]);

  assert.deepEqual(await resetDemo(), { event: 1, zones: 3, volunteers: 9 });
  assert.deepEqual(db.rows("alerts").map((a) => a.event_id), ["other"], "only this event's rows are deleted");
  assert.equal(db.rows("agent_log").length, 0);
  assert.equal(db.rows("zones").length, 3);
  assert.equal(db.rows("volunteers").length, 9);
  assert.equal(db.rows("volunteers").find((v) => v.callsign === "M1")!.status, "busy");
  const ev = db.rows("events")[0];
  assert.deepEqual([ev.status, ev.facts_json.place, ev.facts_json.plan.submitted], ["live", "Grand Parade", true]);
});

test("reset demo works on an empty database (first run)", async () => {
  db.tables = {};
  await resetDemo();
  assert.equal(db.rows("events")[0].name, "Halifax Climate Vigil");
  assert.ok(!("plan" in db.rows("events")[0].facts_json));
});

// ---- Agent log ----

test("logAgent writes one feed row; a failed write is reported but never crashes the agent", async () => {
  await logAgent("Human", "approved", "Organizer approved", { x: 1 }, "ref-1");
  assert.deepEqual(
    (({ event_id, agent, action, summary, input_ref, output_json }) => ({ event_id, agent, action, summary, input_ref, output_json }))(db.rows("agent_log")[0]),
    { event_id: EVENT_ID, agent: "Human", action: "approved", summary: "Organizer approved", input_ref: "ref-1", output_json: { x: 1 } },
  );
  const err = mock.method(console, "error", () => {});
  db.failNext("agent_log", "insert");
  await assert.doesNotReject(logAgent("Monitor", "alert", "x"));
  assert.equal(err.mock.callCount(), 1);
});
