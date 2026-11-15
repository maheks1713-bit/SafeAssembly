import { callAgent, prompt } from "../gemini";
import { logAgent } from "../log";
import { monitorRules, NEED, type Report, type Zone, type Wx, type TransitSignal, type ExistingAlert } from "../rules";
import { MonitorOut, alertTitle } from "../schemas";
import { sb, must } from "../supabase";
import { env } from "../env";

export type AlertRow = {
  id: string; zone_id: string; risk_type: string; severity: number; explanation: string; status: string; created_at: string;
};

/** Rules create the alerts; Gemini only writes the one-line explanation. Inserts alerts + agent_log rows. */
export async function monitorAgent(
  reports: Report[], zones: Zone[], wx: Wx, transit: TransitSignal[], existing: ExistingAlert[],
): Promise<AlertRow[]> {
  const raw = monitorRules(reports, zones, wx, transit, existing);
  const created: AlertRow[] = [];

  for (const a of raw) {
    let explanation = capitalise(a.facts) + ".";
    let source = "rules";
    try {
      const r = await callAgent({
        agent: "monitor",
        tier: "fast",
        system: prompt("monitor.txt"),
        input: { RISK: a, ZONES: zones.map((z) => ({ id: z.id, name: z.name, has_exit: z.has_exit })) },
        schema: MonitorOut,
        cacheKey: `monitor_${a.risk_type}_${a.zone_id}`,
      });
      explanation = r.out.explanation;
      source = r.source;
    } catch (e) {
      console.warn("[monitor] using rule text:", (e as Error).message);
    }

    const row = must(
      await sb.from("alerts").insert({
        event_id: env.eventId, zone_id: a.zone_id, risk_type: a.risk_type, severity: a.severity, explanation,
      }).select().single(),
      "insert alert",
    ) as AlertRow;
    created.push(row);

    const handoff = NEED[a.risk_type] ? "Dispatcher" : null;
    await logAgent("Monitor", "alert", `${alertTitle(a.risk_type, a.zone_id)}: ${explanation}`, {
      zone: a.zone_id, risk_type: a.risk_type, severity: a.severity, rule_facts: a.facts,
      handoff, source, why: `Rule: ${a.facts}.`,
    }, row.id);
  }
  return created;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
