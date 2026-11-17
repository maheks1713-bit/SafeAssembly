import { z } from "zod";

// Gemini output contracts. Keep them simple: plain string enums, no unions, no optional nesting.

export const MonitorOut = z.object({ explanation: z.string() });

export const DispatcherOut = z.object({
  assignments: z.array(z.object({ callsign: z.string(), instruction: z.string() })),
  reason: z.string(),
  escalate_reason: z.string(),
  announcement_en: z.string(),
  announcement_fr: z.string(),
});

export const CommsOut = z.object({
  about_event: z.boolean(),
  claim: z.string(),
  verdict: z.enum(["false", "misleading", "accurate", "unverifiable"]),
  harm: z.enum(["none", "confusion", "incitement"]),
  correction_en: z.string(),
  correction_fr: z.string(),
});

export const PlannerOut = z.object({
  permit_fields: z.array(z.object({ label: z.string(), value: z.string() })),
  permit_markdown: z.string(),
  checklist: z.array(z.object({ item: z.string(), owner: z.string(), due: z.string(), done: z.boolean() })),
  route_notes: z.string(),
  questions_for_city: z.array(z.string()),
});

export const RightsOut = z.object({
  answer: z.string(),
  cited_sections: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  covered: z.boolean(),
  disclaimer: z.string(),
});

export const ReportOut = z.object({
  summary: z.string(),
  timeline: z.array(z.object({ time: z.string(), text: z.string() })),
  lessons: z.array(z.string()),
});

export const EmailOut = z.object({ subject: z.string(), body: z.string() });

export const RISK_LABEL: Record<string, string> = {
  choke_point: "Choke point",
  overcrowding: "Overcrowding",
  medical: "Medical",
  blocked_exit: "Exit blocked",
  cold_wind_stress: "Cold stress",
  heat_stress: "Heat stress",
  dispersal_risk: "Dispersal risk",
};

export const ZONE_NAME: Record<string, string> = {
  stage: "Stage",
  main_square: "Main Square",
  barrington_exit: "Barrington Exit",
  all: "all zones",
};

export const alertTitle = (risk: string, zone: string) =>
  `${RISK_LABEL[risk] ?? risk} ${zone === "all" ? "· all zones" : `at ${ZONE_NAME[zone] ?? zone}`}`;

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

/** "7:11 PM" in Halifax time. */
export const halifaxTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Halifax" });
