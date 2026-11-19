import "./test/env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { alertTitle, slug, halifaxTime, CommsOut, DispatcherOut, RightsOut, RISK_LABEL } from "./schemas";
import { must } from "./supabase";
import { FACTS, POSTS } from "./golden";

test("alertTitle names the risk and zone, with a special case for event-wide alerts", () => {
  assert.equal(alertTitle("choke_point", "barrington_exit"), "Choke point at Barrington Exit");
  assert.equal(alertTitle("cold_wind_stress", "all"), "Cold stress · all zones");
  assert.equal(alertTitle("mystery", "nowhere"), "mystery at nowhere", "unknown ids fall back to the raw value");
});

test("every risk the rules can raise has a label", () => {
  for (const r of ["choke_point", "overcrowding", "medical", "blocked_exit", "cold_wind_stress", "heat_stress", "dispersal_risk"])
    assert.ok(RISK_LABEL[r], r);
});

test("slug makes stable cache keys from free text", () => {
  assert.equal(slug("Can I film police?"), "can_i_film_police");
  assert.equal(slug("  Faut-il un permis ?  "), "faut_il_un_permis");
  assert.equal(slug("Si je suis détenu ?"), "si_je_suis_d_tenu", "matches the committed French cache file name");
  assert.equal(slug("x".repeat(100)).length, 60);
});

test("halifaxTime formats in Atlantic time regardless of the server's zone", () => {
  assert.equal(halifaxTime("2026-11-15T23:11:00Z"), "7:11 PM"); // AST = UTC-4
});

test("CommsOut rejects verdicts outside the allowed set", () => {
  const ok = { about_event: true, claim: "c", verdict: "false", harm: "none", correction_en: "", correction_fr: "" };
  assert.doesNotThrow(() => CommsOut.parse(ok));
  assert.throws(() => CommsOut.parse({ ...ok, verdict: "maybe" }));
  assert.throws(() => CommsOut.parse({ ...ok, harm: "lots" }));
});

test("DispatcherOut and RightsOut require every field", () => {
  assert.throws(() => DispatcherOut.parse({ assignments: [], reason: "r" }));
  assert.throws(() => RightsOut.parse({ answer: "a", cited_sections: [], confidence: "sure", covered: true, disclaimer: "" }));
});

test("must returns data, and throws with context on a Supabase error", () => {
  assert.deepEqual(must({ data: [1], error: null }, "load"), [1]);
  assert.throws(() => must({ data: null, error: { message: "denied" } }, "load event"), /load event: denied/);
});

test("golden scenario data: event is ON and the injector has 2 false, 1 incitement, 2 accurate posts", () => {
  assert.equal(FACTS.status, "ON");
  assert.deepEqual(Object.keys(POSTS).sort(), ["accurate", "accurate-sound", "fake-cancel", "fake-moved", "incitement"]);
});
