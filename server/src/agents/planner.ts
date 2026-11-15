import { callAgent, prompt } from "../gemini";
import { logAgent } from "../log";
import { PlannerOut } from "../schemas";
import { sb, must } from "../supabase";
import { env } from "../env";

export type PlanForm = {
  name?: string; place?: string; when?: string; size?: string; sound?: string; route?: string; activity?: string;
};

const DISCLAIMER = "Draft only. Verify with HRM (Halifax Regional Municipality) before you submit.";

/** Gemini only; the disclaimer is always appended in code. Result is stored in events.facts_json.plan. */
export async function plannerAgent(form: PlanForm) {
  const ev = must(await sb.from("events").select("*").eq("id", env.eventId).single(), "load event");
  const facts = (ev.facts_json ?? {}) as Record<string, unknown>;
  const event = {
    name: form.name ?? ev.name,
    place: form.place ?? facts.place,
    when: form.when ?? facts.time,
    expected_size: form.size ?? facts.expected_size,
    amplified_sound: form.sound ?? facts.amplified_sound,
    route: form.route ?? facts.route,
    activity: form.activity ?? facts.activity,
    volunteers: "6 marshals, 2 medics, 1 legal observer (recruited)",
    warming_tent: facts.warming_tent,
  };

  const r = await callAgent({
    agent: "planner",
    tier: "smart",
    system: prompt("planner.txt"),
    input: { EVENT: event, PERMIT_TEMPLATE: prompt("permit_template.md") },
    schema: PlannerOut,
    cacheKey: "planner",
    timeoutMs: 25000,
  });

  const plan = {
    ...r.out,
    permit_markdown: `${r.out.permit_markdown.trim()}\n\n_${DISCLAIMER}_`,
    disclaimer: DISCLAIMER,
    event,
    generated_at: new Date().toISOString(),
    ms: r.ms,
    source: r.source,
    submitted: false,
  };

  // Form edits update the event's source of truth too (Comms checks posts against these).
  const nextFacts = {
    ...facts,
    place: event.place, time: event.when, expected_size: event.expected_size,
    amplified_sound: event.amplified_sound, route: event.route, activity: event.activity, plan,
  };
  must(await sb.from("events").update({ facts_json: nextFacts, name: event.name }).eq("id", env.eventId), "save plan");

  const done = plan.checklist.filter((c) => c.done).length;
  await logAgent("Planner", "plan",
    `Drafted the permit application and a safety checklist (${done} of ${plan.checklist.length} done) in ${Math.max(1, Math.round(r.ms / 1000))} s.`,
    { checklist_done: done, checklist_total: plan.checklist.length, questions_for_city: plan.questions_for_city, source: r.source });
  return plan;
}

export async function markPlanSubmitted() {
  const ev = must(await sb.from("events").select("facts_json").eq("id", env.eventId).single(), "load event");
  const facts = (ev.facts_json ?? {}) as Record<string, any>;
  if (!facts.plan) throw new Error("No plan to submit yet");
  facts.plan.submitted = true;
  must(await sb.from("events").update({ facts_json: facts }).eq("id", env.eventId), "save plan");
  await logAgent("Human", "plan_submitted", "Organizer marked the permit application as submitted to HRM.");
  return facts.plan;
}
