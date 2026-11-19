import "./test/env";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { callAgent, prompt, setGeminiClientForTests } from "./gemini";
import { CACHE_DIR, env, geminiEnabled } from "./env";
import { MonitorOut } from "./schemas";

const Out = z.object({ answer: z.string() });
const TEST_KEY = "__unit_test_gemini";
const testCache = path.join(CACHE_DIR, `${TEST_KEY}.json`);

/** Turn on "live" mode with a fake client that returns each scripted reply in turn. */
function live(replies: (string | Error | "hang")[]) {
  Object.assign(env, { geminiKey: "k", modelFast: "fast", modelSmart: "smart" });
  let i = 0;
  const calls: unknown[] = [];
  setGeminiClientForTests({
    models: {
      generateContent: async (req: unknown) => {
        calls.push(req);
        const r = replies[i++] ?? new Error("no more replies");
        if (r === "hang") return new Promise(() => {});
        if (r instanceof Error) throw r;
        return { text: r };
      },
    },
  }, { writeCache: true }); // these tests write only to their own __unit_test_ key, removed after each test
  return calls;
}

afterEach(() => {
  Object.assign(env, { geminiKey: "", modelFast: "", modelSmart: "" });
  setGeminiClientForTests(null);
  fs.rmSync(testCache, { force: true });
});

test("tests run cache-only: the real Gemini key from .env is never loaded", () => {
  assert.equal(geminiEnabled(), false);
});

test("prompt() reads prompt files from src/prompts", () => {
  assert.match(prompt("rights_text.md"), /\S/);
  assert.throws(() => prompt("does-not-exist.txt"));
});

test("cache-only mode serves the committed golden answer", async () => {
  const r = await callAgent({ agent: "monitor", tier: "fast", system: "", input: {}, schema: MonitorOut, cacheKey: "monitor_choke_point_barrington_exit" });
  assert.equal(r.source, "cache");
  assert.ok(r.out.explanation.length > 0);
});

test("cache-only mode with no cache entry throws a clear error", async () => {
  await assert.rejects(
    callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out, cacheKey: "__missing_key" }),
    /x failed and no cache \(GEMINI_API_KEY\/model env vars not set\)/,
  );
  await assert.rejects(callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out }), /no cache/);
});

test("live: a valid reply is returned, sent as JSON with a cleaned schema, and written to cache", async () => {
  const calls = live([JSON.stringify({ answer: "hi" })]);
  const r = await callAgent({ agent: "x", tier: "smart", system: "SYS", input: { q: 1 }, schema: Out, cacheKey: TEST_KEY });
  assert.deepEqual(r.out, { answer: "hi" });
  assert.equal(r.source, "gemini");
  const req = calls[0] as { contents: string; config: { systemInstruction: string; responseJsonSchema: object } };
  assert.equal(req.contents, JSON.stringify({ q: 1 }));
  assert.equal(req.config.systemInstruction, "SYS");
  const schemaText = JSON.stringify(req.config.responseJsonSchema);
  assert.ok(!schemaText.includes("$schema") && !schemaText.includes("additionalProperties"), "Gemini-unsupported keys stripped");
  assert.deepEqual(JSON.parse(fs.readFileSync(testCache, "utf8")), { answer: "hi" });
});

test("live: retries once after invalid JSON or a schema mismatch", async () => {
  live(["not json", JSON.stringify({ answer: "second try" })]);
  assert.equal((await callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out })).out.answer, "second try");

  live([JSON.stringify({ wrong: 1 }), JSON.stringify({ answer: "ok" })]);
  assert.equal((await callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out })).out.answer, "ok");
});

test("live: two failures fall back to the cache", async () => {
  fs.writeFileSync(testCache, JSON.stringify({ answer: "cached" }));
  const calls = live([new Error("quota"), new Error("quota")]);
  const r = await callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out, cacheKey: TEST_KEY });
  assert.equal(calls.length, 2, "exactly one retry");
  assert.deepEqual([r.source, r.out.answer], ["cache", "cached"]);
});

test("live: a hung call times out, and the error mentions no env problem", async () => {
  live(["hang", "hang"]);
  const t = Date.now();
  await assert.rejects(callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out, timeoutMs: 30 }), (e: Error) =>
    e.message === "x failed and no cache");
  assert.ok(Date.now() - t < 2000);
});

test("a corrupt cache entry is rejected by the schema instead of being served", async () => {
  fs.writeFileSync(testCache, JSON.stringify({ nope: true }));
  await assert.rejects(callAgent({ agent: "x", tier: "fast", system: "", input: {}, schema: Out, cacheKey: TEST_KEY }));
});
