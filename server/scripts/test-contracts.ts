// npm run test-contracts
// Calls every agent prompt with golden-path input and zod-validates the output (Phase 6 "Gemini contracts" test).
// Uses the same cache keys as the agents, so a passing run also warms cache/ for the demo. Commit cache/ after.
// Needs only GEMINI_* env vars (no Supabase).
import { callAgent, prompt } from "../src/gemini";
import { geminiEnabled } from "../src/env";
import { MonitorOut, DispatcherOut, CommsOut, PlannerOut, RightsOut, ReportOut, slug } from "../src/schemas";
import { FACTS, POSTS } from "../src/golden";

const ZONES = [
  { id: "stage", name: "Stage", has_exit: false },
  { id: "main_square", name: "Main Square", has_exit: false },
  { id: "barrington_exit", name: "Barrington Exit", has_exit: true },
];

const cases: [string, () => Promise<{ source: string; ms: number }>][] = [
  ["monitor choke point", () => callAgent({ agent: "monitor", tier: "fast", system: prompt("monitor.txt"), schema: MonitorOut, cacheKey: "monitor_choke_point_barrington_exit",
    input: { RISK: { zone_id: "barrington_exit", risk_type: "choke_point", severity: 3, facts: "crowd level 5 reported at exit zone Barrington Exit (the only east exit)" }, ZONES } })],
  ["monitor cold", () => callAgent({ agent: "monitor", tier: "fast", system: prompt("monitor.txt"), schema: MonitorOut, cacheKey: "monitor_cold_wind_stress_all",
    input: { RISK: { zone_id: "all", risk_type: "cold_wind_stress", severity: 2, facts: "feels like -16C, wind 42 km/h (Open-Meteo)" }, ZONES } })],
  ["monitor medical", () => callAgent({ agent: "monitor", tier: "fast", system: prompt("monitor.txt"), schema: MonitorOut, cacheKey: "monitor_medical_stage",
    input: { RISK: { zone_id: "stage", risk_type: "medical", severity: 3, facts: "medical help requested in Stage" }, ZONES } })],
  ["dispatcher choke point", () => callAgent({ agent: "dispatcher", tier: "fast", system: prompt("dispatcher.txt"), schema: DispatcherOut, cacheKey: "dispatcher_choke_point_barrington_exit",
    input: { ALERT: { zone: "Barrington Exit", risk_type: "choke_point", severity: 3, explanation: "Crowd level 5 at the only east exit." },
      SEND: [{ callsign: "M2", role: "marshal", from_zone: "Main Square" }, { callsign: "M5", role: "marshal", from_zone: "Main Square" }],
      HOLD: [{ callsign: "M4", role: "marshal", zone: "Barrington Exit" }], ESCALATE_911: false } })],
  ["dispatcher cold", () => callAgent({ agent: "dispatcher", tier: "fast", system: prompt("dispatcher.txt"), schema: DispatcherOut, cacheKey: "dispatcher_cold_wind_stress_all",
    input: { ALERT: { zone: "Stage", risk_type: "cold_wind_stress", severity: 2, explanation: "Feels like -16C with 42 km/h wind." },
      SEND: [{ callsign: "Medic-1", role: "medic", from_zone: "Stage" }], HOLD: [], ESCALATE_911: false } })],
  ["dispatcher medical", () => callAgent({ agent: "dispatcher", tier: "fast", system: prompt("dispatcher.txt"), schema: DispatcherOut, cacheKey: "dispatcher_medical_stage",
    input: { ALERT: { zone: "Stage", risk_type: "medical", severity: 3, explanation: "Medical help requested at Stage." },
      SEND: [{ callsign: "Medic-2", role: "medic", from_zone: "Main Square" }], HOLD: [], ESCALATE_911: true } })],
  ...(["fake-cancel", "incitement", "accurate"] as const).map((p) => [`comms ${p}`, () => callAgent({
    agent: "comms", tier: "fast", system: prompt("comms.txt"), schema: CommsOut, cacheKey: `comms_${p}`,
    input: { EVENT_FACTS: FACTS, POST: POSTS[p].text } })] as [string, () => Promise<{ source: string; ms: number }>]),
  ["planner", () => callAgent({ agent: "planner", tier: "smart", system: prompt("planner.txt"), schema: PlannerOut, cacheKey: "planner", timeoutMs: 25000,
    input: { EVENT: { name: "Halifax Climate Vigil", place: FACTS.place, when: FACTS.time, expected_size: FACTS.expected_size, amplified_sound: FACTS.amplified_sound,
      route: FACTS.route, activity: FACTS.activity, volunteers: "6 marshals, 2 medics, 1 legal observer (recruited)", warming_tent: FACTS.warming_tent },
      PERMIT_TEMPLATE: prompt("permit_template.md") } })],
  ...[
    ["en", "Can police tell us to move?"], ["fr", "Can police tell us to move?"], ["fr", "La police peut-elle nous dire de partir ?"],
    ["en", "Do we need a permit?"], ["en", "Can I film police?"], ["en", "If I'm detained?"], ["en", "What if they ask for my name?"],
    ["fr", "Faut-il un permis ?"], ["fr", "Puis-je filmer la police ?"], ["fr", "Si je suis détenu ?"],
  ].map(([lang, q]) => [`rights ${lang} ${q}`, () => callAgent({ agent: "rights", tier: "smart", system: prompt("rights.txt"), schema: RightsOut,
    cacheKey: `rights_${lang}_${slug(q)}`, timeoutMs: 12000, input: { LANG: lang, QUESTION: q, RIGHTS_TEXT: prompt("rights_text.md") } })] as [string, () => Promise<{ source: string; ms: number }>]),
  ["rights not covered", () => callAgent({ agent: "rights", tier: "smart", system: prompt("rights.txt"), schema: RightsOut, timeoutMs: 12000,
    input: { LANG: "en", QUESTION: "Can I be deported for attending?", RIGHTS_TEXT: prompt("rights_text.md") } })],
];

if (!geminiEnabled()) console.warn("GEMINI_API_KEY / model env vars not set: testing cache files only.\n");

let pass = 0;
for (const [name, run] of cases) {
  try {
    const r = await run();
    const slow = r.ms > 8000 ? "  (SLOW > 8 s)" : "";
    console.log(`PASS  ${name.padEnd(48)} ${r.source.padEnd(6)} ${r.ms} ms${slow}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  ${name.padEnd(48)} ${(e as Error).message}`);
  }
}
console.log(`\n${pass}/${cases.length} valid JSON`);
process.exit(pass === cases.length ? 0 : 1);
