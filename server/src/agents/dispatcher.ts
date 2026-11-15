import { callAgent, prompt } from "../gemini";
import { logAgent } from "../log";
import { pickVolunteers, holders, needs911, targetZone, NEED, type Volunteer } from "../rules";
import { DispatcherOut, ZONE_NAME, RISK_LABEL, alertTitle } from "../schemas";
import { sb, must } from "../supabase";
import { env } from "../env";
import type { AlertRow } from "./monitor";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const isWeather = (risk: string) => risk === "cold_wind_stress" || risk === "heat_stress";

/**
 * Code picks the people (nearest free volunteer with the right role); Gemini writes 20-word radio instructions.
 * Writes assignments, updates volunteers, and drafts a 911 escalation / weather announcement when needed.
 * `vols` is mutated so the next alert in the same tick sees updated statuses.
 */
export async function dispatcherAgent(alert: AlertRow, vols: Volunteer[]) {
  const send = pickVolunteers(vols, alert);
  const hold = holders(vols, alert);
  const escalate = needs911(alert);
  const target = targetZone(alert);
  const zoneName = ZONE_NAME[target];

  if (!NEED[alert.risk_type] && !escalate) return; // e.g. dispersal risk: informational only

  if (send.length === 0 && hold.length === 0 && !escalate) {
    await logAgent("Dispatcher", "no_volunteer",
      `No free ${NEED[alert.risk_type]?.[0]?.role ?? "volunteer"} available for ${alertTitle(alert.risk_type, alert.zone_id)}. Organizer should reassign manually.`,
      { zone: alert.zone_id, risk_type: alert.risk_type }, alert.id);
    return;
  }

  const zoneOf = (v: Volunteer) => ZONE_NAME[v.zone_id ?? ""] ?? v.zone_id;
  const fallback = {
    assignments: [
      ...send.map((v) => ({
        callsign: v.callsign,
        instruction: isWeather(alert.risk_type)
          ? `${zoneName}: go to the warming tent. Check on people feeling the cold.`
          : `${zoneName}: move now. ${RISK_LABEL[alert.risk_type]}. Report to ${hold[0]?.callsign ?? "lead"} on arrival.`,
      })),
      ...hold.map((v) => ({
        callsign: v.callsign,
        instruction: `${zoneName}: hold the line. Guide people back toward Main Square. ${list(send.map((s) => s.callsign))} joining you.`,
      })),
    ],
    reason: `${list(send.map((v) => v.callsign))} were the nearest free ${NEED[alert.risk_type]?.[0]?.role ?? "volunteer"}s.${hold.length ? ` ${list(hold.map((v) => v.callsign))} stays to hold the line.` : ""}`,
    escalate_reason: escalate ? `${RISK_LABEL[alert.risk_type]} at ${zoneName}: severity 3. ${alert.explanation}` : "",
    announcement_en: isWeather(alert.risk_type) ? "Warming tent is open at the Stage. Please look out for each other." : "",
    announcement_fr: isWeather(alert.risk_type) ? "La tente chauffée est ouverte près de la scène. Prenez soin les uns des autres." : "",
  };

  let out = fallback;
  let source = "template";
  try {
    const r = await callAgent({
      agent: "dispatcher",
      tier: "fast",
      system: prompt("dispatcher.txt"),
      input: {
        ALERT: { zone: zoneName, risk_type: alert.risk_type, severity: alert.severity, explanation: alert.explanation },
        SEND: send.map((v) => ({ callsign: v.callsign, role: v.role, from_zone: zoneOf(v) })),
        HOLD: hold.map((v) => ({ callsign: v.callsign, role: v.role, zone: zoneOf(v) })),
        ESCALATE_911: escalate,
      },
      schema: DispatcherOut,
      cacheKey: `dispatcher_${alert.risk_type}_${alert.zone_id}`,
    });
    out = r.out;
    source = r.source;
  } catch (e) {
    console.warn("[dispatcher] using template instructions:", (e as Error).message);
  }

  // Code decides who; the model only words it. Ignore any callsign the model invented.
  const instructionFor = (v: Volunteer) =>
    out.assignments.find((a) => a.callsign === v.callsign)?.instruction ??
    fallback.assignments.find((a) => a.callsign === v.callsign)!.instruction;

  const rows = [
    ...send.map((v) => ({ v, kind: "move" as const })),
    ...hold.map((v) => ({ v, kind: "hold" as const })),
  ].map(({ v, kind }) => ({
    event_id: env.eventId, volunteer_id: v.id, zone_id: target, instruction: instructionFor(v), alert_id: alert.id, kind,
  }));
  if (rows.length) must(await sb.from("assignments").insert(rows), "insert assignments");

  for (const v of [...send, ...hold]) {
    const moving = send.includes(v);
    v.status = "assigned";
    if (moving) v.zone_id = target;
    must(await sb.from("volunteers").update({ status: "assigned", ...(moving ? { zone_id: target } : {}) }).eq("id", v.id), "update volunteer");
  }

  const sentText = send.length ? `Sent ${list(send.map((v) => v.callsign))} to ${zoneName}.` : "";
  const holdText = hold.length ? ` ${list(hold.map((v) => v.callsign))} holds the line.` : "";
  await logAgent("Dispatcher", "assign", `${sentText}${holdText}`.trim() || `Reviewed ${alertTitle(alert.risk_type, alert.zone_id)}.`, {
    assign: send.map((v) => v.callsign), hold: hold.map((v) => v.callsign), zone: target,
    escalate_911: escalate, why: out.reason, source,
  }, alert.id);

  if (escalate) {
    const draft = must(await sb.from("drafts").insert({
      event_id: env.eventId, kind: "escalation_911", alert_id: alert.id,
      body_en: out.escalate_reason || fallback.escalate_reason, body_fr: "",
      reason: out.escalate_reason || fallback.escalate_reason, source_text: alert.explanation,
      meta: { priority: "high", zone: alert.zone_id, risk_type: alert.risk_type },
    }).select("id").single(), "insert 911 draft");
    await logAgent("Dispatcher", "escalation_draft",
      `Recommends calling 911 for ${alertTitle(alert.risk_type, alert.zone_id)}. A human decides.`,
      { draft_id: draft.id, awaiting_approval: true, why: out.escalate_reason }, alert.id);
  }

  if (isWeather(alert.risk_type) && (out.announcement_en || fallback.announcement_en)) {
    const draft = must(await sb.from("drafts").insert({
      event_id: env.eventId, kind: "announcement",
      body_en: out.announcement_en || fallback.announcement_en, body_fr: out.announcement_fr || fallback.announcement_fr,
      reason: "Warming tent open at Stage", source_text: alert.explanation, meta: { priority: "normal" },
    }).select("id").single(), "insert announcement draft");
    await logAgent("Dispatcher", "announcement_draft", "Drafted a public announcement: warming tent open at Stage (EN + FR).",
      { draft_id: draft.id, awaiting_approval: true }, alert.id);
  }
}
