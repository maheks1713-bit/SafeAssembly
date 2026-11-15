// Every write the app makes. Live mode: Supabase (reports, acks) + the agent server (everything AI).
// Mock mode: local changes to the golden-path data, so every screen is tappable with no backend.
import { API_URL, EVENT_ID, USE_MOCKS } from "./config";
import { sb } from "./supabase";
import { mockInsert, mockUpdate, refetchAll } from "./store";
import { MOCK_PLAN, mockHealth, mockReport, mockRights } from "./mocks";
import type { Draft, EventReport, Health, Plan, ReportType, RightsAnswer, ZoneId } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(path: string, body?: unknown, timeoutMs = 45_000): Promise<T> {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URL is not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs); // generous: Render free tier can take ~30 s to wake
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: body === undefined && path === "/health" ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
    return json as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The agent server didn't answer in time. Is it awake?");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Marshal ----

/** Marshal button -> report row (zone only: no names, no GPS) -> /tick. UI updates via Realtime. */
export async function sendReport(zone: ZoneId, type: ReportType, level: number | null = null) {
  if (USE_MOCKS) {
    mockInsert("reports", { id: `r-${Date.now()}`, event_id: EVENT_ID, zone_id: zone, type, level, note: null, created_at: new Date().toISOString() });
    return;
  }
  const { error } = await sb!.from("reports").insert({ event_id: EVENT_ID, zone_id: zone, type, level });
  if (error) throw new Error(error.message);
  call("/tick", {}).catch((e) => console.warn("[tick]", e.message)); // fire-and-forget
}

export async function acknowledge(assignmentId: string) {
  if (USE_MOCKS) return mockUpdate("assignments", assignmentId, { acknowledged: true });
  const { error } = await sb!.from("assignments").update({ acknowledged: true }).eq("id", assignmentId);
  if (error) throw new Error(error.message);
}

// ---- Organizer ----

export async function approveDraft(d: Draft, edits?: { body_en?: string; body_fr?: string }) {
  if (USE_MOCKS) return mockUpdate("drafts", d.id, { ...edits, status: "approved", decided_at: new Date().toISOString() });
  await call(`/drafts/${d.id}/approve`, edits ?? {});
}
export async function rejectDraft(d: Draft) {
  if (USE_MOCKS) return mockUpdate("drafts", d.id, { status: "rejected", decided_at: new Date().toISOString() });
  await call(`/drafts/${d.id}/reject`, {});
}
export async function resolveAlert(id: string) {
  if (USE_MOCKS) return mockUpdate("alerts", id, { status: "handled" });
  await call(`/alerts/${id}/resolve`, {});
}

export async function generatePlan(form: Record<string, string>): Promise<Plan> {
  if (USE_MOCKS) { await wait(1500); return { ...MOCK_PLAN, generated_at: new Date().toISOString() }; }
  return call<Plan>("/plan", form, 60_000);
}
export async function markSubmitted(): Promise<Plan> {
  if (USE_MOCKS) return { ...MOCK_PLAN, submitted: true };
  return call<Plan>("/plan/submitted", {});
}
export async function askRights(question: string, lang: "en" | "fr"): Promise<RightsAnswer> {
  if (USE_MOCKS) { await wait(1200); return mockRights(question, lang); }
  return call<RightsAnswer>("/rights", { question, lang });
}
export async function generateReport(): Promise<EventReport> {
  if (USE_MOCKS) { await wait(1800); return mockReport(); }
  return call<EventReport>("/report", {}, 60_000);
}

// ---- Scenario Injector ----

export type InjectKind = "crowd5" | "medical" | "blocked-exit" | "cold-snap" | "transit" | "fake-cancel" | "incitement" | "accurate";

export async function health(): Promise<Health> {
  if (USE_MOCKS) return mockHealth();
  return call<Health>("/health", undefined, 60_000);
}
export async function inject(kind: InjectKind) {
  if (USE_MOCKS) { await wait(400); return; }
  await call(`/inject/${kind}`, {});
}
export async function injectPaste(text: string) {
  if (USE_MOCKS) { await wait(400); return; }
  await call("/inject/paste", { text });
}
export async function resetDemo() {
  if (!USE_MOCKS) await call("/reset", {});
  refetchAll();
}
