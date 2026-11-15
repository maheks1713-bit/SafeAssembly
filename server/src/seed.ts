import { sb, must } from "./supabase";
import { env } from "./env";
import { FACTS } from "./golden";

// Stable ids so the app can hard-code EVENT_ID and so a reset never orphans a phone's session.
const vid = (n: number) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`;

// Grand Parade, Halifax (approx). "box" is the stylised map layout in % used by the app.
const ZONES = [
  {
    id: "stage", name: "Stage", has_exit: false, capacity_level: 1,
    polygon_json: {
      coords: [[44.64905, -63.57560], [44.64905, -63.57510], [44.64880, -63.57510], [44.64880, -63.57560]],
      box: { x: 9, y: 7, w: 38, h: 30 },
    },
  },
  {
    id: "main_square", name: "Main Square", has_exit: false, capacity_level: 2,
    polygon_json: {
      coords: [[44.64878, -63.57560], [44.64878, -63.57470], [44.64835, -63.57470], [44.64835, -63.57560]],
      box: { x: 9, y: 43, w: 70, h: 45 },
    },
  },
  {
    id: "barrington_exit", name: "Barrington Exit", has_exit: true, capacity_level: 1,
    polygon_json: {
      coords: [[44.64905, -63.57468], [44.64905, -63.57445], [44.64835, -63.57445], [44.64835, -63.57468]],
      box: { x: 69, y: 7, w: 19, h: 81 },
    },
  },
];

const VOLUNTEERS = [
  { n: 1, callsign: "M1", role: "marshal", zone_id: "main_square", status: "busy" }, // at the info table
  { n: 2, callsign: "M2", role: "marshal", zone_id: "main_square", status: "free" },
  { n: 3, callsign: "M3", role: "marshal", zone_id: "stage", status: "free" },
  { n: 4, callsign: "M4", role: "marshal", zone_id: "barrington_exit", status: "free" },
  { n: 5, callsign: "M5", role: "marshal", zone_id: "main_square", status: "free" },
  { n: 6, callsign: "M6", role: "marshal", zone_id: "stage", status: "free" },
  { n: 7, callsign: "Medic-1", role: "medic", zone_id: "stage", status: "free" },
  { n: 8, callsign: "Medic-2", role: "medic", zone_id: "main_square", status: "free" },
  { n: 9, callsign: "Legal-1", role: "legal_observer", zone_id: "main_square", status: "free" },
];


/** Deletes all live data for the demo event and re-inserts the golden-path starting state. */
export async function resetDemo() {
  const ev = env.eventId;
  // Children first (foreign keys).
  for (const t of ["agent_log", "drafts", "assignments", "alerts", "signals", "reports"]) {
    must(await sb.from(t).delete().eq("event_id", ev), `clear ${t}`);
  }
  must(await sb.from("volunteers").delete().eq("event_id", ev), "clear volunteers");
  must(await sb.from("zones").delete().eq("event_id", ev), "clear zones");

  const existing = must(await sb.from("events").select("facts_json").eq("id", ev).maybeSingle(), "read event");
  // Keep a previously generated plan so the Plan tab isn't empty after every reset.
  const plan = (existing?.facts_json as { plan?: unknown } | null)?.plan;

  must(
    await sb.from("events").upsert({
      id: ev,
      name: "Halifax Climate Vigil",
      location: "Grand Parade",
      // Demo: the event "started" ~70 min ago so the LIVE timer reads like the design (facts_json.time is the real slot).
      start_time: new Date(Date.now() - 70 * 60_000).toISOString(),
      expected_size: 800,
      facts_json: plan ? { ...FACTS, plan } : FACTS,
      status: "live",
    }),
    "upsert event",
  );
  must(await sb.from("zones").insert(ZONES.map((z) => ({ ...z, event_id: ev }))), "insert zones");
  must(
    await sb.from("volunteers").insert(
      VOLUNTEERS.map(({ n, ...v }) => ({ id: vid(n), event_id: ev, ...v })),
    ),
    "insert volunteers",
  );
  return { event: 1, zones: ZONES.length, volunteers: VOLUNTEERS.length };
}
