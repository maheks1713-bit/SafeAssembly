// Row types mirror server/sql/schema.sql.

export type ZoneId = "stage" | "main_square" | "barrington_exit";
export type ReportType = "crowd" | "medical" | "blocked_exit" | "other";
export type AgentName = "Planner" | "Rights" | "Monitor" | "Dispatcher" | "Comms" | "Report" | "Human";

export type EventRow = {
  id: string; name: string; location: string; start_time: string; expected_size: number; status: string;
  facts_json: { time?: string; place?: string; status?: string; official_updates?: string; expected_size?: string;
    amplified_sound?: string; route?: string; activity?: string; plan?: Plan; report?: EventReport } | null;
};
export type Zone = {
  id: ZoneId; event_id: string; name: string; capacity_level: number; has_exit: boolean;
  polygon_json: { box: { x: number; y: number; w: number; h: number } } | null;
};
export type Volunteer = {
  id: string; event_id: string; role: "marshal" | "medic" | "legal_observer"; callsign: string;
  zone_id: ZoneId | null; status: "free" | "assigned" | "busy";
};
export type ReportRow = {
  id: string; event_id: string; zone_id: ZoneId; type: ReportType; level: number | null; note: string | null; created_at: string;
};
export type Signal = {
  id: string; event_id: string; source: "weather" | "transit" | "social";
  payload_json: Record<string, any>; processed: boolean; created_at: string;
};
export type Alert = {
  id: string; event_id: string; zone_id: ZoneId | "all"; risk_type: string; severity: number;
  explanation: string; status: "open" | "handled"; created_at: string;
};
export type Assignment = {
  id: string; event_id: string; volunteer_id: string; zone_id: string; instruction: string; alert_id: string | null;
  acknowledged: boolean; created_at: string; kind: "move" | "hold";
};
export type Draft = {
  id: string; event_id: string; kind: "correction" | "announcement" | "escalation_911";
  body_en: string | null; body_fr: string | null; reason: string | null; source_text: string | null;
  status: "pending" | "approved" | "rejected"; decided_at: string | null; created_at: string;
  meta: { verdict?: string; harm?: string; claim?: string; priority?: "high" | "normal"; shares?: number | null; zone?: string; risk_type?: string } | null;
  alert_id: string | null;
};
export type AgentLog = {
  id: string; event_id: string; agent: AgentName; action: string; summary: string;
  input_ref: string | null; output_json: Record<string, any> | null; created_at: string;
};

export type Tables = {
  events: EventRow; zones: Zone; volunteers: Volunteer; reports: ReportRow; signals: Signal;
  alerts: Alert; assignments: Assignment; drafts: Draft; agent_log: AgentLog;
};
export type TableName = keyof Tables;

// ---- Agent route responses (see docs/contracts.md) ----
export type Plan = {
  permit_fields: { label: string; value: string }[];
  permit_markdown: string;
  checklist: { item: string; owner: string; due: string; done: boolean }[];
  route_notes: string;
  questions_for_city: string[];
  disclaimer: string;
  generated_at: string;
  ms: number;
  source: "gemini" | "cache";
  submitted: boolean;
};
export type RightsAnswer = {
  answer: string; cited_sections: string[]; confidence: "high" | "medium" | "low"; covered: boolean;
  disclaimer: string; ms: number; source: string;
};
export type EventReport = {
  summary: string;
  stats: { alerts: number; people_moved: number; corrections: number; calls_911: number };
  timeline: { time: string; text: string }[];
  lessons: string[];
  event_name: string; ended_at: string; generated_at: string; privacy: string; source: string;
};
export type Health = { ok: boolean; last_tick: string | null; last_error: string | null; gemini: "live" | "cache-only"; event_id: string };
