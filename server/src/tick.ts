import { sb, must } from "./supabase";
import { env } from "./env";
import { monitorAgent } from "./agents/monitor";
import { dispatcherAgent } from "./agents/dispatcher";
import { commsAgent, type SocialSignal } from "./agents/comms";
import type { Volunteer, Wx } from "./rules";

export const tickState = { lastTick: null as string | null, lastResult: null as unknown, lastError: null as string | null };

let running: Promise<TickResult> | null = null;
let queued: Promise<TickResult> | null = null;

type TickResult = { alerts: number; posts: number };

/**
 * Simple lock: if a tick is running, callers share ONE follow-up tick that starts when it finishes,
 * so a burst of marshal taps never runs the agents twice on the same data.
 */
export function runTick(): Promise<TickResult> {
  if (!running) {
    running = tickOnce().finally(() => { running = null; });
    return running;
  }
  if (!queued) {
    queued = running.catch(() => undefined).then(() => {
      queued = null;
      return runTick();
    });
  }
  return queued;
}

async function tickOnce(): Promise<TickResult> {
  const ev = env.eventId;
  const since = new Date(Date.now() - 10 * 60_000).toISOString();

  const [event, reports, zones, vols, pending, weather, existing] = await Promise.all([
    sb.from("events").select("facts_json,status").eq("id", ev).single().then((r) => must(r, "event")),
    sb.from("reports").select("zone_id,type,level,created_at").eq("event_id", ev).gte("created_at", since).order("created_at").then((r) => must(r, "reports")),
    sb.from("zones").select("id,name,has_exit").eq("event_id", ev).then((r) => must(r, "zones")),
    sb.from("volunteers").select("id,callsign,role,zone_id,status").eq("event_id", ev).then((r) => must(r, "volunteers")),
    sb.from("signals").select("*").eq("event_id", ev).eq("processed", false).in("source", ["transit", "social"]).order("created_at").then((r) => must(r, "signals")),
    sb.from("signals").select("payload_json,created_at").eq("event_id", ev).eq("source", "weather").order("created_at", { ascending: false }).limit(1).then((r) => must(r, "weather")),
    sb.from("alerts").select("zone_id,risk_type,status,created_at").eq("event_id", ev).then((r) => must(r, "alerts")),
  ]);

  const w = weather[0];
  const wx: Wx = w ? { apparent_temperature: Number(w.payload_json.apparent_temperature), wind_speed_10m: Number(w.payload_json.wind_speed_10m), created_at: w.created_at } : null;
  const transit = pending.filter((s) => s.source === "transit").map((s) => ({ text: String(s.payload_json?.text ?? "Transit disruption"), created_at: s.created_at }));
  const social = pending.filter((s) => s.source === "social") as SocialSignal[];

  // Mark first so a parallel tick can never process the same post twice.
  if (pending.length) must(await sb.from("signals").update({ processed: true }).in("id", pending.map((s) => s.id)), "mark processed");

  // 1. Monitor -> 2. Dispatcher for each new alert -> 3. Comms for each new post. Everything logs to agent_log.
  const alerts = await monitorAgent(reports, zones, wx, transit, existing);
  const volunteers = vols as Volunteer[];
  for (const a of alerts) await dispatcherAgent(a, volunteers);
  for (const s of social) await commsAgent(s, (event.facts_json ?? {}) as Record<string, unknown>);

  const result = { alerts: alerts.length, posts: social.length };
  tickState.lastTick = new Date().toISOString();
  tickState.lastResult = result;
  return result;
}
