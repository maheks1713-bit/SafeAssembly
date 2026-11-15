import { sb, must } from "./supabase";
import { env } from "./env";
import { runTick } from "./tick";

// Grand Parade, Halifax. Open-Meteo is free and needs no key.
const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=44.65&longitude=-63.57" +
  "&current=temperature_2m,apparent_temperature,wind_speed_10m,precipitation";

const COLD_SNAP = { temperature_2m: -9, apparent_temperature: -16, wind_speed_10m: 42, precipitation: 0, forced: true };

export async function pollWeather() {
  // A forced cold snap from the Scenario Injector wins for an hour, so real weather doesn't undo the demo.
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const forced = must(
    await sb.from("signals").select("id").eq("event_id", env.eventId).eq("source", "weather")
      .eq("payload_json->>forced", "true").gte("created_at", hourAgo).limit(1),
    "check forced weather",
  );
  if (forced.length) return;

  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = (await res.json()) as { current: Record<string, number> };
  must(await sb.from("signals").insert({ event_id: env.eventId, source: "weather", payload_json: j.current, processed: true }), "insert weather");
  await runTick();
}

export async function forceColdSnap() {
  must(await sb.from("signals").insert({ event_id: env.eventId, source: "weather", payload_json: COLD_SNAP, processed: true }), "insert cold snap");
}

export function startWeatherPoller() {
  if (!env.weatherPoll) return;
  const run = () => pollWeather().catch((e) => console.error("[weather]", e.message));
  run();
  setInterval(run, 5 * 60_000);
}
