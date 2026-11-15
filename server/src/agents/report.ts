import { callAgent, prompt } from "../gemini";
import { logAgent } from "../log";
import { ReportOut, alertTitle, halifaxTime } from "../schemas";
import { sb, must } from "../supabase";
import { env } from "../env";

/** Stats are counted in code; Gemini writes the summary, timeline and lessons. */
export async function reportAgent() {
  const ev = env.eventId;
  const [event, logs, alerts, assignments, drafts] = await Promise.all([
    sb.from("events").select("*").eq("id", ev).single().then((r) => must(r, "event")),
    sb.from("agent_log").select("agent,action,summary,created_at").eq("event_id", ev).order("created_at").then((r) => must(r, "logs")),
    sb.from("alerts").select("zone_id,risk_type,severity,explanation,status,created_at").eq("event_id", ev).order("created_at").then((r) => must(r, "alerts")),
    sb.from("assignments").select("volunteer_id,kind,created_at").eq("event_id", ev).then((r) => must(r, "assignments")),
    sb.from("drafts").select("kind,status,reason,created_at,decided_at").eq("event_id", ev).then((r) => must(r, "drafts")),
  ]);

  const stats = {
    alerts: alerts.length,
    people_moved: new Set(assignments.filter((a) => a.kind === "move").map((a) => a.volunteer_id)).size,
    corrections: drafts.filter((d) => d.kind === "correction" && d.status === "approved").length,
    calls_911: drafts.filter((d) => d.kind === "escalation_911" && d.status === "approved").length,
  };
  const endedAt = new Date().toISOString();

  const fallback = {
    summary: `${event.name} ended at ${halifaxTime(endedAt)}. ${stats.alerts} alerts were raised and ${stats.people_moved} volunteers were moved; every public message was approved by a person.`,
    timeline: logs
      .filter((l) => (l.agent === "Monitor" && l.action === "alert") || l.action === "correction_draft" ||
        (l.agent === "Human" && ["approved", "call_911", "resolved"].includes(l.action)))
      .slice(0, 8)
      .map((l) => ({ time: halifaxTime(l.created_at), text: l.summary.length > 110 ? `${l.summary.slice(0, 107)}...` : l.summary })),
    lessons: [
      "Review this timeline with marshal leads within a week.",
      "Set up the warming tent before the start, not after the first alert.",
    ],
  };

  let out = fallback;
  let source = "template";
  try {
    const r = await callAgent({
      agent: "report",
      tier: "smart",
      system: prompt("report.txt"),
      input: {
        EVENT: { name: event.name, place: event.location, expected_size: event.expected_size, ended_at: halifaxTime(endedAt) },
        STATS: stats,
        LOG: logs.map((l) => ({ time: halifaxTime(l.created_at), agent: l.agent, action: l.action, summary: l.summary })),
        ALERTS: alerts.map((a) => ({ time: halifaxTime(a.created_at), title: alertTitle(a.risk_type, a.zone_id), severity: a.severity, status: a.status })),
        DRAFTS: drafts.map((d) => ({ kind: d.kind, status: d.status, reason: d.reason })),
      },
      schema: ReportOut,
      cacheKey: "report",
      timeoutMs: 20000,
    });
    out = r.out;
    source = r.source;
  } catch (e) {
    console.warn("[report] using template report:", (e as Error).message);
  }

  const report = {
    ...out,
    stats,
    event_name: event.name,
    ended_at: endedAt,
    generated_at: new Date().toISOString(),
    privacy: "Contains no names, photos or locations of attendees. Logs are deleted 30 days after the event.",
    source,
  };
  const facts = { ...(event.facts_json ?? {}), report };
  must(await sb.from("events").update({ status: "ended", facts_json: facts }).eq("id", ev), "save report");
  await logAgent("Report", "report",
    `Wrote the event report: ${stats.alerts} alerts, ${stats.people_moved} people moved, ${stats.corrections} correction, ${stats.calls_911} 911 call.`,
    { stats, source });
  return report;
}
