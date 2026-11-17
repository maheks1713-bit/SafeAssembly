import { Router } from "express";
import { z } from "zod";
import { plannerAgent, markPlanSubmitted } from "../agents/planner";
import { rightsAgent } from "../agents/rights";
import { reportAgent } from "../agents/report";
import { advocacyAgent } from "../agents/advocacy";

export const agentRoutes = Router();

// On-demand agents. Express 5 forwards async errors to the error handler in index.ts.

agentRoutes.post("/plan", async (req, res) => {
  const form = z.object({
    name: z.string(), place: z.string(), when: z.string(), size: z.string(),
    sound: z.string(), route: z.string(), activity: z.string(),
  }).partial().parse(req.body ?? {});
  res.json(await plannerAgent(form));
});

agentRoutes.post("/plan/submitted", async (_req, res) => {
  res.json(await markPlanSubmitted());
});

agentRoutes.post("/rights", async (req, res) => {
  const { question, lang } = z.object({
    question: z.string().trim().min(2).max(500),
    lang: z.enum(["en", "fr"]).default("en"),
  }).parse(req.body);
  res.json(await rightsAgent(question, lang));
});

agentRoutes.post("/report", async (_req, res) => {
  res.json(await reportAgent());
});

// Participant email drafts. Public-facing, so: small inputs only, and a per-phone rate limit to
// protect the shared Gemini quota. Over the limit the app writes the draft on the phone instead.
const short = (max: number) => z.string().trim().min(1).max(max);
const EmailReq = z.object({
  to: z.object({ title: short(80), office: short(100), salutation: short(80) }),
  event: z.object({ name: short(100), place: short(100), time: short(60) }),
  about: short(600), ask: short(300), angle: short(120), tone: short(40),
  avoid: z.array(z.string().max(400)).max(5).default([]),
});
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

agentRoutes.post("/participant/email", async (req, res) => {
  const body = EmailReq.parse(req.body);
  const who = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(who) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(who, recent);
    return void res.status(429).json({ error: "Too many drafts for now. Writing one on your phone instead." });
  }
  recent.push(now);
  hits.set(who, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  res.json(await advocacyAgent(body));
});
