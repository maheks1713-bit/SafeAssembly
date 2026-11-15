import { Router } from "express";
import { z } from "zod";
import { sb, must } from "../supabase";
import { logAgent } from "../log";
import { alertTitle } from "../schemas";

export const draftRoutes = Router();

// Human-in-the-loop: approvals go through the server so every decision is logged.

draftRoutes.post("/drafts/:id/approve", async (req, res) => {
  const edits = z.object({ body_en: z.string(), body_fr: z.string() }).partial().parse(req.body ?? {});
  const draft = await decide(req.params.id, "approved", edits);
  if (draft.kind === "escalation_911") {
    // SafeAssembly never dials. In production the app opens the dialer with 911 ready; a human presses call.
    await logAgent("Human", "call_911", `Organizer chose to call 911 (${draft.reason ?? "escalation"}). SafeAssembly never calls by itself.`, { draft_id: draft.id });
  } else {
    const what = draft.kind === "correction" ? "correction" : "announcement";
    await logAgent("Human", "approved", `Organizer approved the ${what} (EN + FR) and sent it. Human approved.`,
      { draft_id: draft.id, edited: Boolean(edits.body_en || edits.body_fr) });
  }
  res.json(draft);
});

draftRoutes.post("/drafts/:id/reject", async (req, res) => {
  const draft = await decide(req.params.id, "rejected", {});
  const summary = draft.kind === "escalation_911"
    ? "Organizer decided a 911 call was not needed."
    : `Organizer rejected the ${draft.kind} draft. Nothing was sent.`;
  await logAgent("Human", "rejected", summary, { draft_id: draft.id });
  res.json(draft);
});

draftRoutes.post("/alerts/:id/resolve", async (req, res) => {
  const alert = must(await sb.from("alerts").update({ status: "handled" }).eq("id", req.params.id).select().single(), "resolve alert");
  // Free the volunteers who were working this alert.
  const asg = must(await sb.from("assignments").select("volunteer_id").eq("alert_id", alert.id), "load assignments");
  const ids = [...new Set(asg.map((a) => a.volunteer_id))];
  if (ids.length) must(await sb.from("volunteers").update({ status: "free" }).in("id", ids), "free volunteers");
  await logAgent("Human", "resolved", `Organizer marked "${alertTitle(alert.risk_type, alert.zone_id)}" as handled.`, { alert_id: alert.id });
  res.json(alert);
});

async function decide(id: string, status: "approved" | "rejected", edits: { body_en?: string; body_fr?: string }) {
  const current = must(await sb.from("drafts").select("status").eq("id", id).single(), "load draft");
  if (current.status !== "pending") throw Object.assign(new Error(`Draft already ${current.status}`), { status: 409 });
  return must(
    await sb.from("drafts").update({ status, decided_at: new Date().toISOString(), ...edits }).eq("id", id).select().single(),
    "update draft",
  );
}
