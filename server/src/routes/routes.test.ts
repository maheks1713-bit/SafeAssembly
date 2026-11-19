// HTTP-level tests: the real Express app on a random port, backed by the in-memory database.
import { EVENT_ID } from "../test/env";
import { test, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { installFakeDb, seedGolden, logTrail, type FakeDb } from "../test/fakeDb";
import { app } from "../app";
import { FACTS } from "../golden";

let server: Server;
let base = "";
let db: FakeDb;

before(async () => {
  mock.method(console, "error", () => {}); // expected 4xx/5xx paths log; keep output readable
  mock.method(console, "warn", () => {});
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); mock.restoreAll(); });
beforeEach(() => { db = installFakeDb(); seedGolden(db, EVENT_ID, { ...FACTS }); });

async function post(path: string, body: unknown = {}) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as any };
}
const draft = (kind: string, status = "pending") => {
  db.seed("drafts", [{ event_id: EVENT_ID, kind, status, body_en: "EN", body_fr: "FR", reason: "medical at Stage" }]);
  return db.rows("drafts").at(-1)!.id as string;
};

// ---- Health + tick ----

test("GET /health reports cache-only mode and the event id", async () => {
  const j = (await (await fetch(`${base}/health`)).json()) as any;
  assert.equal(j.ok, true);
  assert.equal(j.gemini, "cache-only");
  assert.equal(j.event_id, EVENT_ID);
});

test("POST /tick runs the agents; a failure is returned as 500 and shown on /health", async () => {
  db.seed("reports", [{ event_id: EVENT_ID, zone_id: "stage", type: "medical", level: null }]);
  assert.deepEqual((await post("/tick")).json, { alerts: 1, posts: 0 });

  db.failNext("events", "select", "db offline");
  const r = await post("/tick");
  assert.equal(r.status, 500);
  assert.match(r.json.error, /db offline/);
  assert.match(((await (await fetch(`${base}/health`)).json()) as any).last_error, /db offline/);
});

// ---- Approvals (human in the loop) ----

test("approving a correction stores the organizer's edits and logs a human approval", async () => {
  const id = draft("correction");
  const r = await post(`/drafts/${id}/approve`, { body_en: "Edited EN" });
  assert.equal(r.status, 200);
  const d = db.rows("drafts")[0];
  assert.deepEqual([d.status, d.body_en, d.body_fr], ["approved", "Edited EN", "FR"]);
  assert.ok(d.decided_at);
  const [log] = db.rows("agent_log");
  assert.equal(`${log.agent}:${log.action}`, "Human:approved");
  assert.equal(log.output_json.edited, true);
});

test("approving a 911 draft only logs the decision; SafeAssembly never dials", async () => {
  const id = draft("escalation_911");
  await post(`/drafts/${id}/approve`);
  const [log] = db.rows("agent_log");
  assert.equal(log.action, "call_911");
  assert.match(log.summary, /never calls by itself/);
});

test("rejecting drafts: nothing is sent, and 911 rejections read as 'not needed'", async () => {
  await post(`/drafts/${draft("correction")}/reject`);
  await post(`/drafts/${draft("escalation_911")}/reject`);
  assert.deepEqual(db.rows("drafts").map((d) => d.status), ["rejected", "rejected"]);
  const [a, b] = db.rows("agent_log").map((l) => l.summary);
  assert.match(a, /Nothing was sent/);
  assert.match(b, /911 call was not needed/);
});

test("a draft can only be decided once (409), so a double tap can't send twice", async () => {
  const id = draft("announcement");
  assert.equal((await post(`/drafts/${id}/approve`)).status, 200);
  const again = await post(`/drafts/${id}/approve`);
  assert.equal(again.status, 409);
  assert.match(again.json.error, /already approved/);
  assert.deepEqual(logTrail(db), ["Human:approved"]);
});

test("invalid approval edits are a 400, not a crash", async () => {
  const r = await post(`/drafts/${draft("correction")}/approve`, { body_en: 42 });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "Invalid request");
});

test("resolving an alert marks it handled and frees the volunteers working it", async () => {
  db.seed("alerts", [{ id: "al1", event_id: EVENT_ID, zone_id: "barrington_exit", risk_type: "choke_point", severity: 3, status: "open" }]);
  db.seed("assignments", [{ event_id: EVENT_ID, alert_id: "al1", volunteer_id: "v2" }, { event_id: EVENT_ID, alert_id: "al1", volunteer_id: "v4" }]);
  for (const v of db.rows("volunteers")) if (["v2", "v4"].includes(v.id)) v.status = "assigned";

  await post("/alerts/al1/resolve");
  assert.equal(db.rows("alerts")[0].status, "handled");
  const status = (id: string) => db.rows("volunteers").find((v) => v.id === id)!.status;
  assert.deepEqual([status("v2"), status("v4"), status("v1")], ["free", "free", "busy"]);
  assert.match(db.rows("agent_log")[0].summary, /marked "Choke point at Barrington Exit" as handled/);
});

// ---- Scenario Injector ----

test("injector: each button inserts one row and runs the tick", async () => {
  const r = await post("/inject/crowd5");
  assert.deepEqual(r.json, { ok: true, tick: { alerts: 1, posts: 0 } });
  assert.deepEqual(db.rows("reports").map((x) => [x.zone_id, x.type, x.level]), [["barrington_exit", "crowd", 5]]);

  await post("/inject/fake-cancel");
  assert.equal(db.rows("drafts").filter((d) => d.kind === "correction").length, 1);
});

test("injector: cold snap and transit buttons", async () => {
  await post("/inject/cold-snap");
  await post("/inject/transit");
  const risks = db.rows("alerts").map((a) => a.risk_type).sort();
  assert.deepEqual(risks, ["cold_wind_stress", "dispersal_risk"]);
});

test("injector: unknown scenario is a 404 that lists the valid ones", async () => {
  const r = await post("/inject/meteor");
  assert.equal(r.status, 404);
  assert.match(r.json.error, /crowd5.*paste/);
});

test("injector paste: validates length, then fact-checks the pasted post", async () => {
  assert.equal((await post("/inject/paste", { text: "hi" })).status, 400);
  const r = await post("/inject/paste", { text: "The vigil is moved to Citadel Hill" });
  assert.equal(r.json.tick.posts, 1);
  assert.equal(db.rows("signals")[0].payload_json.shares, null);
});

test("POST /reset re-seeds the demo", async () => {
  await post("/inject/medical");
  const r = await post("/reset");
  assert.deepEqual(r.json.seeded, { event: 1, zones: 3, volunteers: 9 });
  assert.equal(db.rows("alerts").length, 0);
});

// ---- On-demand agents ----

test("POST /plan returns a plan; /plan/submitted marks it", async () => {
  assert.match((await post("/plan", { name: "My Vigil" })).json.permit_markdown, /Draft only/);
  assert.equal((await post("/plan/submitted")).json.submitted, true);
});

test("POST /rights validates the question and the language", async () => {
  assert.equal((await post("/rights", { question: "?" })).status, 400);
  assert.equal((await post("/rights", { question: "Can I film police?", lang: "de" })).status, 400);
  const r = await post("/rights", { question: "Can I film police?" });
  assert.equal(r.status, 200);
  assert.equal(r.json.disclaimer, "General information, not legal advice.");
});

test("POST /report ends the event", async () => {
  const r = await post("/report");
  assert.equal(r.status, 200);
  assert.equal(db.rows("events")[0].status, "ended");
});

test("participant email: rejects oversized input, and rate-limits each phone to 6 drafts per 10 minutes", async () => {
  const body = {
    to: { title: "Mayor", office: "HRM", salutation: "Dear Mayor" },
    event: { name: "Vigil", place: "Grand Parade", time: "6 PM" },
    about: "a", ask: "b", angle: "c", tone: "d",
  };
  assert.equal((await post("/participant/email", { ...body, about: "x".repeat(601) })).status, 400);
  // Offline (no Gemini), each allowed call fails with 500 and the app writes the email on the phone.
  for (let i = 0; i < 6; i++) assert.equal((await post("/participant/email", body)).status, 500, `call ${i + 1}`);
  const limited = await post("/participant/email", body);
  assert.equal(limited.status, 429);
  assert.match(limited.json.error, /Writing one on your phone instead/);
});
