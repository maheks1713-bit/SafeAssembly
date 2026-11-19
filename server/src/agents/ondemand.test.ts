// Planner, Rights, Report and Advocacy: the agents an organizer or participant calls on demand.
import { EVENT_ID } from "../test/env";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeDb, seedGolden, logTrail, type FakeDb } from "../test/fakeDb";
import { plannerAgent, markPlanSubmitted } from "./planner";
import { rightsAgent } from "./rights";
import { reportAgent } from "./report";
import { advocacyAgent } from "./advocacy";
import { setGeminiClientForTests } from "../gemini";
import { env } from "../env";
import { FACTS } from "../golden";

let db: FakeDb;
beforeEach(() => { db = installFakeDb(); seedGolden(db, EVENT_ID, { ...FACTS }); });
afterEach(() => {
  Object.assign(env, { geminiKey: "", modelFast: "", modelSmart: "" });
  setGeminiClientForTests(null);
});
const event = () => db.rows("events")[0];

// ---- Planner ----

test("planner: drafts a permit, always appends the HRM disclaimer, and saves it in the event facts", async () => {
  const plan = await plannerAgent({});
  assert.match(plan.permit_markdown, /_Draft only\. Verify with HRM .* before you submit\._$/);
  assert.equal(plan.submitted, false);
  assert.ok(plan.checklist.length > 0);
  assert.equal(event().facts_json.plan.permit_markdown, plan.permit_markdown);
  assert.deepEqual(logTrail(db), ["Planner:plan"]);
});

test("planner: form edits become the new source of truth that Comms checks posts against", async () => {
  await plannerAgent({ name: "Renamed Vigil", place: "Victoria Park", when: "Sun 5 PM" });
  assert.equal(event().name, "Renamed Vigil");
  assert.deepEqual([event().facts_json.place, event().facts_json.time], ["Victoria Park", "Sun 5 PM"]);
  assert.equal(event().facts_json.route, FACTS.route, "fields not in the form keep their value");
});

test("planner: marking submitted flips the flag and is logged as a human action", async () => {
  await assert.rejects(markPlanSubmitted(), /No plan to submit yet/);
  await plannerAgent({});
  const plan = await markPlanSubmitted();
  assert.equal(plan.submitted, true);
  assert.equal(event().facts_json.plan.submitted, true);
  assert.deepEqual(logTrail(db), ["Planner:plan", "Human:plan_submitted"]);
});

// ---- Rights ----

test("rights: answers from the curated text with the disclaimer enforced in code, in EN and FR", async () => {
  const en = await rightsAgent("Can I film police?", "en");
  assert.equal(en.disclaimer, "General information, not legal advice.");
  assert.ok(en.answer.length > 0);
  const fr = await rightsAgent("Puis-je filmer la police ?", "fr");
  assert.equal(fr.disclaimer, "Information générale, pas un avis juridique.");
  assert.deepEqual(logTrail(db), ["Rights:answer", "Rights:answer"]);
});

test("rights: a model-supplied disclaimer can't replace the enforced one; uncovered questions point to legal aid", async () => {
  Object.assign(env, { geminiKey: "k", modelFast: "f", modelSmart: "s" });
  setGeminiClientForTests({ models: { generateContent: async () => ({ text: JSON.stringify({
    answer: "Not in the guide.", cited_sections: [], confidence: "low", covered: false, disclaimer: "This is legal advice." }) }) } });
  const r = await rightsAgent("Can I bring a dog?", "en");
  assert.equal(r.disclaimer, "General information, not legal advice.");
  assert.match(db.rows("agent_log")[0].summary, /Not covered: pointed to legal aid/);
});

test("rights: an unknown question with no Gemini and no cache fails loudly", async () => {
  await assert.rejects(rightsAgent("Totally new question", "en"), /rights failed and no cache/);
});

// ---- Report ----

test("report: stats are counted in code, the event is ended, and a template report is used offline", async () => {
  db.seed("alerts", [
    { event_id: EVENT_ID, zone_id: "barrington_exit", risk_type: "choke_point", severity: 3, status: "handled", explanation: "e" },
    { event_id: EVENT_ID, zone_id: "stage", risk_type: "medical", severity: 3, status: "open", explanation: "e" },
  ]);
  db.seed("assignments", [
    { event_id: EVENT_ID, volunteer_id: "v2", kind: "move" },
    { event_id: EVENT_ID, volunteer_id: "v2", kind: "move" }, // same person twice counts once
    { event_id: EVENT_ID, volunteer_id: "v5", kind: "move" },
    { event_id: EVENT_ID, volunteer_id: "v4", kind: "hold" }, // holding is not moving
  ]);
  db.seed("drafts", [
    { event_id: EVENT_ID, kind: "correction", status: "approved" },
    { event_id: EVENT_ID, kind: "correction", status: "rejected" },
    { event_id: EVENT_ID, kind: "escalation_911", status: "approved" },
    { event_id: EVENT_ID, kind: "escalation_911", status: "pending" },
  ]);
  db.seed("agent_log", [{ event_id: EVENT_ID, agent: "Monitor", action: "alert", summary: "Choke point at Barrington Exit" }]);
  // Another event's rows must not leak into this report.
  db.seed("alerts", [{ event_id: "other", zone_id: "stage", risk_type: "medical", severity: 3, status: "open" }]);

  const r = await reportAgent();
  assert.deepEqual(r.stats, { alerts: 2, people_moved: 2, corrections: 1, calls_911: 1 });
  assert.equal(r.source, "template");
  assert.equal(r.timeline[0].text, "Choke point at Barrington Exit");
  assert.match(r.privacy, /no names, photos or locations/);
  assert.equal(event().status, "ended");
  assert.deepEqual(event().facts_json.report.stats, r.stats);
  assert.equal(event().facts_json.place, FACTS.place, "other facts kept");
  assert.deepEqual(logTrail(db).slice(-1), ["Report:report"]);
});

// ---- Advocacy (participant email) ----

const emailReq = {
  to: { title: "Mayor", office: "HRM", salutation: "Dear Mayor" },
  event: { name: "Vigil", place: "Grand Parade", time: "6 PM" },
  about: "a", ask: "b", angle: "c", tone: "d", avoid: [],
};

test("advocacy: returns a trimmed Gemini draft and is not written to the event log", async () => {
  Object.assign(env, { geminiKey: "k", modelFast: "f", modelSmart: "s" });
  setGeminiClientForTests({ models: { generateContent: async () => ({ text: JSON.stringify({ subject: "  Hi  ", body: "\nBody\n" }) }) } });
  const r = await advocacyAgent(emailReq);
  assert.deepEqual([r.subject, r.body, r.source], ["Hi", "Body", "gemini"]);
  assert.equal(db.rows("agent_log").length, 0);
});

test("advocacy: never served from cache (everyone would get the same email), so offline it throws", async () => {
  await assert.rejects(advocacyAgent(emailReq), /no cache/);
});
