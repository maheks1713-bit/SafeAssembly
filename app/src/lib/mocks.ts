// Golden-path sample data (mirrors docs/contracts.md). Used when USE_MOCKS is true.
import { EVENT_ID } from "./config";
import type { Tables, Plan, RightsAnswer, EventReport, Health } from "./types";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const vid = (n: number) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`;
const id = (p: string, n: number) => `${p}-${n}`;
const E = EVENT_ID;

export const MOCK_PLAN: Plan = {
  permit_fields: [
    { label: "Organizer", value: "[YOUR GROUP NAME]" },
    { label: "Location", value: "Grand Parade, Barrington St side" },
    { label: "Activity", value: "Candlelight vigil, 3 short speeches, no march" },
    { label: "Safety plan", value: "6 marshals, 2 medics, 1 legal observer; warming tent at stage" },
    { label: "Sound", value: "One battery speaker, off by 8 PM" },
  ],
  permit_markdown: "## Public gathering application (draft)\n\n_Draft only. Verify with HRM._",
  checklist: [
    ["Recruit 6 marshals with callsigns M1–M6", "Marshal lead", "1 week before", true],
    ["Recruit 2 medics with first-aid kits", "Medic lead", "1 week before", true],
    ["Recruit a legal observer", "Organizer", "1 week before", true],
    ["Submit the HRM application", "Organizer", "1 week before", true],
    ["Confirm candle rules with HRM", "Organizer", "3 days before", false],
    ["Confirm whether a noise permit is needed", "Sound", "3 days before", false],
    ["Brief marshals on zones and exit plan", "Marshal lead", "Day before", true],
    ["Post official update account in event description", "Organizer", "Day before", true],
    ["Charge speaker and backup battery", "Sound", "Day before", true],
    ["Pack warming tent, blankets, hand warmers", "Medic lead", "Day before", true],
    ["Check weather forecast and wind", "Organizer", "Day of", true],
    ["Set up warming tent at stage before start", "Medic lead", "On site", true],
    ["Walk the Barrington St exit; keep lane clear", "Marshal lead", "On site", true],
    ["Radio / group-chat check with all volunteers", "Marshal lead", "On site", true],
    ["Sound off by 8 PM", "Sound", "On site", true],
    ["Clean-up sweep for wax and litter", "Organizer", "After", true],
  ].map(([item, owner, due, done]) => ({ item, owner, due, done })) as Plan["checklist"],
  route_notes:
    "No march: people gather on Grand Parade and leave the same way. The Barrington St side is the only east exit and becomes a choke point when the crowd leaves at once; keep a marshal there and a clear lane. Use the George St side as a second exit if attendance passes 600.",
  questions_for_city: ["Are open flames (candles) allowed on the square?", "Is a noise permit needed for one speaker?"],
  disclaimer: "Draft only. Verify with HRM (Halifax Regional Municipality) before you submit.",
  generated_at: ago(95),
  ms: 9000,
  source: "cache",
  submitted: false,
};

export function mockTables(): { [K in keyof Tables]: Tables[K][] } {
  return {
    events: [{
      id: E, name: "Halifax Climate Vigil", location: "Grand Parade", start_time: ago(72), expected_size: 800, status: "live",
      facts_json: { time: "Sat 6-8 PM", place: "Grand Parade", status: "ON", official_updates: "[YOUR ACCOUNT]",
        expected_size: "~800 people", amplified_sound: "Yes, one speaker", plan: MOCK_PLAN },
    }],
    zones: [
      { id: "stage", event_id: E, name: "Stage", capacity_level: 1, has_exit: false, polygon_json: { box: { x: 9, y: 7, w: 38, h: 30 } } },
      { id: "main_square", event_id: E, name: "Main Square", capacity_level: 2, has_exit: false, polygon_json: { box: { x: 9, y: 43, w: 70, h: 45 } } },
      { id: "barrington_exit", event_id: E, name: "Barrington Exit", capacity_level: 1, has_exit: true, polygon_json: { box: { x: 69, y: 7, w: 19, h: 81 } } },
    ],
    volunteers: [
      { id: vid(1), event_id: E, role: "marshal", callsign: "M1", zone_id: "main_square", status: "busy" },
      { id: vid(2), event_id: E, role: "marshal", callsign: "M2", zone_id: "barrington_exit", status: "assigned" },
      { id: vid(3), event_id: E, role: "marshal", callsign: "M3", zone_id: "stage", status: "free" },
      { id: vid(4), event_id: E, role: "marshal", callsign: "M4", zone_id: "barrington_exit", status: "assigned" },
      { id: vid(5), event_id: E, role: "marshal", callsign: "M5", zone_id: "barrington_exit", status: "assigned" },
      { id: vid(6), event_id: E, role: "marshal", callsign: "M6", zone_id: "stage", status: "free" },
      { id: vid(7), event_id: E, role: "medic", callsign: "Medic-1", zone_id: "stage", status: "assigned" },
      { id: vid(8), event_id: E, role: "medic", callsign: "Medic-2", zone_id: "main_square", status: "free" },
      { id: vid(9), event_id: E, role: "legal_observer", callsign: "Legal-1", zone_id: "main_square", status: "free" },
    ],
    reports: [
      { id: id("r", 2), event_id: E, zone_id: "barrington_exit", type: "crowd", level: 5, note: null, created_at: ago(2) },
      { id: id("r", 1), event_id: E, zone_id: "main_square", type: "crowd", level: 3, note: null, created_at: ago(12) },
    ],
    signals: [
      { id: id("s", 1), event_id: E, source: "weather", processed: true, created_at: ago(9),
        payload_json: { temperature_2m: -9, apparent_temperature: -16, wind_speed_10m: 42, forced: true } },
    ],
    alerts: [
      { id: id("a", 2), event_id: E, zone_id: "barrington_exit", risk_type: "choke_point", severity: 3, status: "open", created_at: ago(2),
        explanation: "M4 reported crowd level 5. It's the only east exit." },
      { id: id("a", 1), event_id: E, zone_id: "all", risk_type: "cold_wind_stress", severity: 2, status: "open", created_at: ago(9),
        explanation: "Feels like −16°C. Warming tent is open at Stage." },
    ],
    assignments: [
      { id: id("as", 4), event_id: E, volunteer_id: vid(4), zone_id: "barrington_exit", alert_id: id("a", 2), acknowledged: false, created_at: ago(2), kind: "hold",
        instruction: "Hold the east line. Guide people back toward Main Square. M2 and M5 joining you." },
      { id: id("as", 2), event_id: E, volunteer_id: vid(2), zone_id: "barrington_exit", alert_id: id("a", 2), acknowledged: false, created_at: ago(2), kind: "move",
        instruction: "Barrington Exit: move now. Help M4 slow the flow and guide people back toward Main Square." },
      { id: id("as", 5), event_id: E, volunteer_id: vid(5), zone_id: "barrington_exit", alert_id: id("a", 2), acknowledged: false, created_at: ago(2), kind: "move",
        instruction: "Barrington Exit: move now. Open space along the barrier, keep the exit lane clear." },
      { id: id("as", 7), event_id: E, volunteer_id: vid(7), zone_id: "stage", alert_id: id("a", 1), acknowledged: true, created_at: ago(9), kind: "move",
        instruction: "Stage: staff the warming tent. Check anyone shivering or confused; blankets and warm drinks." },
    ],
    drafts: [
      { id: id("d", 3), event_id: E, kind: "escalation_911", status: "pending", decided_at: null, created_at: ago(0.2), alert_id: null,
        body_en: "Medic-1 reports a person down, not responding well to cold. Dispatcher recommends calling 911.", body_fr: "",
        reason: "Medic-1 reports a person down, not responding well to cold. Dispatcher recommends calling 911.",
        source_text: "Medical help requested at Stage.", meta: { priority: "high", zone: "stage", risk_type: "medical" } },
      { id: id("d", 2), event_id: E, kind: "correction", status: "pending", decided_at: null, created_at: ago(1), alert_id: null,
        body_en: "The Halifax Climate Vigil is ON at Grand Parade until 8 PM. Official updates only from [YOUR ACCOUNT]. Please share.",
        body_fr: "La vigile pour le climat d'Halifax a bien lieu à Grand Parade jusqu'à 20 h. Mises à jour officielles : [YOUR ACCOUNT]. Merci de partager.",
        reason: "FALSE · contradicts event facts", source_text: "Vigil CANCELLED tonight, police closing Grand Parade. Don't come.",
        meta: { verdict: "false", harm: "confusion", priority: "normal", shares: 140 } },
      { id: id("d", 1), event_id: E, kind: "announcement", status: "approved", decided_at: ago(8), created_at: ago(9), alert_id: null,
        body_en: "Warming tent open at Stage", body_fr: "La tente chauffée est ouverte près de la scène",
        reason: "Warming tent open at Stage", source_text: null, meta: { priority: "normal" } },
    ],
    agent_log: [
      { id: id("l", 7), event_id: E, agent: "Dispatcher", action: "escalation_draft", created_at: ago(0.2), input_ref: null,
        summary: "Recommends calling 911 for Medical at Stage. A human decides.", output_json: { draft_id: id("d", 3), awaiting_approval: true } },
      { id: id("l", 6), event_id: E, agent: "Comms", action: "correction_draft", created_at: ago(1), input_ref: null,
        summary: "Flagged a post saying the vigil is cancelled. False: it contradicts the event facts. Drafted a correction in EN + FR.",
        output_json: { verdict: "false", harm: "confusion", draft_id: id("d", 2), awaiting_approval: true, why: "Claim: The vigil is cancelled and police are closing Grand Parade." } },
      { id: id("l", 5), event_id: E, agent: "Dispatcher", action: "assign", created_at: ago(2), input_ref: id("a", 2),
        summary: "Sent M2 and M5 to Barrington Exit. M4 holds the line.",
        output_json: { assign: ["M2", "M5"], hold: ["M4"], zone: "barrington_exit", escalate_911: false, why: "M2 and M5 were the nearest free marshals (Main Square). M4 stays to hold the line." } },
      { id: id("l", 4), event_id: E, agent: "Monitor", action: "alert", created_at: ago(2.1), input_ref: id("a", 2),
        summary: "Choke point at Barrington Exit: crowd level 5 from M4 in the only east exit.",
        output_json: { zone: "barrington_exit", risk_type: "choke_point", severity: 3, handoff: "Dispatcher", why: "Rule: crowd level 5 at an exit zone." } },
      { id: id("l", 3), event_id: E, agent: "Human", action: "approved", created_at: ago(8), input_ref: null,
        summary: "Organizer approved the announcement (EN + FR) and sent it. Human approved.", output_json: null },
      { id: id("l", 2), event_id: E, agent: "Monitor", action: "alert", created_at: ago(9), input_ref: id("a", 1),
        summary: "Cold stress: feels like −16°C (Open-Meteo). Suggested warming tent at Stage.",
        output_json: { zone: "all", risk_type: "cold_wind_stress", severity: 2, handoff: "Dispatcher" } },
      { id: id("l", 1), event_id: E, agent: "Planner", action: "plan", created_at: ago(95), input_ref: null,
        summary: "Pre-event checklist 14 of 16 done. Open: candle rules, noise permit.", output_json: { checklist_done: 14, checklist_total: 16 } },
    ],
  };
}

const R = (answer: string, cited: string[], fr = false): RightsAnswer => ({
  answer, cited_sections: cited, confidence: "high", covered: true, ms: 1400, source: "cache",
  disclaimer: fr ? "Information générale, pas un avis juridique." : "General information, not legal advice.",
});
export function mockRights(question: string, lang: "en" | "fr"): RightsAnswer {
  if (lang === "fr")
    return R("La Charte protège votre droit de vous réunir pacifiquement. Mais ce droit a des **limites raisonnables**, comme la sécurité et la circulation.\n\nDonc oui, la police peut parfois diriger une foule. Restez calme, demandez quelle loi s'applique, et prévenez votre observateur juridique.", ["Charte art. 2c)", "Charte art. 1"], true);
  if (/film/i.test(question))
    return R("In general, filming in a public place is a form of expression. Film from a safe distance and **don't physically interfere** with police work.", ["Charter s. 2(b)", "Charter s. 1"]);
  return R("The Charter protects your right to gather peacefully. But that right has **reasonable limits**, like safety and traffic.\n\nSo yes, police can sometimes direct a crowd. Stay calm, ask which law or bylaw applies, and tell your legal observer.", ["Charter s. 2(c)", "Charter s. 1"]);
}

export const mockReport = (): EventReport => ({
  summary: "The Halifax Climate Vigil ended peacefully. Agents flagged 3 risks and a false post; organizers approved every public message.",
  stats: { alerts: 3, people_moved: 3, corrections: 1, calls_911: 1 },
  timeline: [
    { time: "7:03 PM", text: "Cold stress alert. Warming tent opened at Stage." },
    { time: "7:11 PM", text: "Choke point at Barrington Exit. M2, M5 sent; cleared in 6 min." },
    { time: "7:12 PM", text: "False 'cancelled' post corrected (EN + FR), approved by organizer." },
    { time: "7:20 PM", text: "Medical at Stage. Organizer called 911; person transported." },
  ],
  lessons: [
    "Open a second exit on George St when more than 600 people attend.",
    "Set up the warming tent before the start, not after the first alert.",
    "Post the official update account in the event description.",
  ],
  event_name: "Halifax Climate Vigil", ended_at: new Date().toISOString(), generated_at: new Date().toISOString(),
  privacy: "Contains no names, photos or locations of attendees. Logs are deleted 30 days after the event.", source: "cache",
});

export const mockHealth = (): Health => ({ ok: true, last_tick: new Date().toISOString(), last_error: null, gemini: "cache-only", event_id: EVENT_ID });
