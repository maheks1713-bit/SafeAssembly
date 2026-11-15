import { Router } from "express";
import { z } from "zod";
import { sb, must } from "../supabase";
import { env } from "../env";
import { runTick } from "../tick";
import { forceColdSnap } from "../weather";
import { resetDemo } from "../seed";
import { POSTS } from "../golden";

export const injectRoutes = Router();

// Scenario Injector (demo operator only). Each button inserts one row, then runs /tick,
// so the result shows up live on the other phones.


const report = async (zone_id: string, type: string, level: number | null = null) => {
  must(await sb.from("reports").insert({ event_id: env.eventId, zone_id, type, level }), "insert report");
};
const signal = async (source: "transit" | "social", payload_json: object) => {
  must(await sb.from("signals").insert({ event_id: env.eventId, source, payload_json }), "insert signal");
};

const KINDS: Record<string, () => Promise<unknown>> = {
  crowd5: () => report("barrington_exit", "crowd", 5),
  medical: () => report("stage", "medical"),
  "blocked-exit": () => report("barrington_exit", "blocked_exit"),
  "cold-snap": () => forceColdSnap(),
  transit: () => signal("transit", { text: "Halifax Transit Route 1 detour on Barrington St: buses not stopping near Grand Parade after 7 PM." }),
};
for (const [preset, p] of Object.entries(POSTS)) KINDS[preset] = () => signal("social", { ...p, preset });

injectRoutes.post("/inject/paste", async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(3).max(1000) }).parse(req.body);
  await signal("social", { text, shares: null });
  res.json({ ok: true, tick: await runTick() });
});

injectRoutes.post("/inject/:kind", async (req, res) => {
  const fn = KINDS[req.params.kind];
  if (!fn) return void res.status(404).json({ error: `Unknown kind. Use one of: ${Object.keys(KINDS).join(", ")}, paste` });
  await fn();
  res.json({ ok: true, tick: await runTick() });
});

injectRoutes.post("/reset", async (_req, res) => {
  res.json({ ok: true, seeded: await resetDemo() });
});
