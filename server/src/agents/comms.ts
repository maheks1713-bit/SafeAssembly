import { callAgent, prompt } from "../gemini";
import { logAgent } from "../log";
import { CommsOut } from "../schemas";
import { sb, must } from "../supabase";
import { env } from "../env";

export type SocialSignal = { id: string; payload_json: { text: string; shares?: number; preset?: string } };

/** Gemini compares the post ONLY to facts_json. Harmful/false posts become drafts; nothing is ever auto-sent. */
export async function commsAgent(s: SocialSignal, facts: Record<string, unknown>) {
  const { text, shares, preset } = s.payload_json;
  const short = text.length > 70 ? `${text.slice(0, 67)}...` : text;
  let r;
  try {
    r = await callAgent({
      agent: "comms",
      tier: "fast",
      system: prompt("comms.txt"),
      input: { EVENT_FACTS: withoutPlan(facts), POST: text },
      schema: CommsOut,
      cacheKey: preset ? `comms_${preset}` : undefined,
    });
  } catch (e) {
    await logAgent("Comms", "error", `Couldn't check a post right now: "${short}". Please review it manually.`,
      { error: (e as Error).message }, s.id);
    return;
  }
  const o = r.out;

  if (!o.about_event && o.harm === "none") {
    await logAgent("Comms", "ignored", `Checked a post: not about this event. No action.`, { ...o, source: r.source }, s.id);
    return;
  }
  if (o.verdict === "accurate" && o.harm === "none") {
    await logAgent("Comms", "verified", `Checked a post: accurate, matches the event facts. No correction needed.`, { ...o, source: r.source }, s.id);
    return;
  }
  if (o.verdict === "unverifiable" && o.harm === "none") {
    await logAgent("Comms", "unverifiable", `Checked a post: can't verify "${o.claim}" from the event facts. Flagged for the organizer.`, { ...o, source: r.source }, s.id);
    return;
  }

  const incitement = o.harm === "incitement";
  const draft = must(await sb.from("drafts").insert({
    event_id: env.eventId,
    kind: "correction",
    body_en: o.correction_en,
    body_fr: o.correction_fr,
    reason: incitement ? "Incitement: high priority. Never auto-replied." : `${o.verdict.toUpperCase()} · contradicts event facts`,
    source_text: text,
    meta: { verdict: o.verdict, harm: o.harm, claim: o.claim, priority: incitement ? "high" : "normal", shares: shares ?? null },
  }).select("id").single(), "insert correction draft");

  const summary = incitement
    ? `HIGH PRIORITY: a post encourages violence or damage. Drafted a calm reply in EN + FR. Nothing is sent without you.`
    : `Flagged a post: "${short}". ${capital(o.verdict)}: it contradicts the event facts. Drafted a correction in EN + FR.`;
  await logAgent("Comms", "correction_draft", summary,
    { ...o, draft_id: draft.id, awaiting_approval: true, source: r.source, why: `Claim: ${o.claim}` }, s.id);
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// The stored plan is large and irrelevant to fact-checking.
const withoutPlan = ({ plan: _plan, report: _report, ...rest }: Record<string, unknown>) => rest;
