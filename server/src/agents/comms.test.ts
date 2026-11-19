import { EVENT_ID } from "../test/env";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeDb, seedGolden, logTrail, type FakeDb } from "../test/fakeDb";
import { commsAgent } from "./comms";
import { setGeminiClientForTests } from "../gemini";
import { env } from "../env";
import { FACTS, POSTS } from "../golden";

let db: FakeDb;
beforeEach(() => { db = installFakeDb(); seedGolden(db, EVENT_ID, FACTS); });
afterEach(() => {
  Object.assign(env, { geminiKey: "", modelFast: "", modelSmart: "" });
  setGeminiClientForTests(null);
});

const post = (preset: keyof typeof POSTS) => ({ id: `sig-${preset}`, payload_json: { ...POSTS[preset], preset } });

/** Fake Gemini that returns one fixed verdict and records what it was shown. */
function verdict(o: Partial<{ about_event: boolean; verdict: string; harm: string }>) {
  Object.assign(env, { geminiKey: "k", modelFast: "f", modelSmart: "s" });
  const seen: string[] = [];
  setGeminiClientForTests({
    models: {
      generateContent: async (req: { contents: string }) => {
        seen.push(req.contents);
        return { text: JSON.stringify({ about_event: true, claim: "c", verdict: "false", harm: "none", correction_en: "EN", correction_fr: "FR", ...o }) };
      },
    },
  });
  return seen;
}

test("fake cancel post: a correction draft in EN + FR waits for approval, never sent", async () => {
  await commsAgent(post("fake-cancel"), FACTS);
  const [d] = db.rows("drafts");
  assert.equal(d.kind, "correction");
  assert.equal(d.status, "pending", "waits in the Approvals inbox");
  assert.ok(d.body_en && d.body_fr);
  assert.equal(d.source_text, POSTS["fake-cancel"].text);
  assert.deepEqual([d.meta.priority, d.meta.shares], ["normal", 140]);
  assert.match(d.reason, /^FALSE/);
  const [log] = db.rows("agent_log");
  assert.equal(`${log.agent}:${log.action}`, "Comms:correction_draft");
  assert.equal(log.output_json.awaiting_approval, true);
  assert.equal(log.input_ref, "sig-fake-cancel");
});

test("incitement post: high-priority calm reply, flagged as never auto-replied", async () => {
  await commsAgent(post("incitement"), FACTS);
  const [d] = db.rows("drafts");
  assert.equal(d.meta.priority, "high");
  assert.match(d.reason, /Never auto-replied/);
  assert.match(db.rows("agent_log")[0].summary, /^HIGH PRIORITY/);
});

test("accurate post: verified, no draft", async () => {
  await commsAgent(post("accurate"), FACTS);
  assert.equal(db.rows("drafts").length, 0);
  assert.deepEqual(logTrail(db), ["Comms:verified"]);
});

test("off-topic and unverifiable posts are logged but drafted nothing", async () => {
  verdict({ about_event: false, harm: "none" });
  await commsAgent({ id: "s1", payload_json: { text: "Nice weather" } }, FACTS);
  verdict({ verdict: "unverifiable", harm: "none" });
  await commsAgent({ id: "s2", payload_json: { text: "Free coffee at the vigil" } }, FACTS);
  assert.deepEqual(logTrail(db), ["Comms:ignored", "Comms:unverifiable"]);
  assert.equal(db.rows("drafts").length, 0);
});

test("an off-topic post that incites harm is still drafted", async () => {
  verdict({ about_event: false, harm: "incitement" });
  await commsAgent({ id: "s", payload_json: { text: "Trash the shops" } }, FACTS);
  assert.equal(db.rows("drafts")[0].meta.priority, "high");
});

test("the model only sees the event facts, never the stored plan or report", async () => {
  const seen = verdict({ verdict: "accurate" });
  await commsAgent({ id: "s", payload_json: { text: "Vigil is on" } }, { ...FACTS, plan: { secret: 1 }, report: { secret: 2 } });
  const input = JSON.parse(seen[0]);
  assert.equal(input.POST, "Vigil is on");
  assert.equal(input.EVENT_FACTS.place, "Grand Parade");
  assert.ok(!("plan" in input.EVENT_FACTS) && !("report" in input.EVENT_FACTS));
});

test("a pasted post with no cache and no Gemini asks the organizer to review it manually", async () => {
  await commsAgent({ id: "s", payload_json: { text: "x".repeat(100) } }, FACTS);
  const [log] = db.rows("agent_log");
  assert.equal(log.action, "error");
  assert.match(log.summary, /Please review it manually/);
  assert.match(log.summary, /x{67}\.\.\./, "long posts are shortened in the summary");
});
