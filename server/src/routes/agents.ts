import { Router } from "express";
import { z } from "zod";
import { plannerAgent, markPlanSubmitted } from "../agents/planner";
import { rightsAgent } from "../agents/rights";
import { reportAgent } from "../agents/report";

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
