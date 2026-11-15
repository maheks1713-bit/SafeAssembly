// Shared live table store. One initial fetch + one Realtime channel per table, shared by every screen.
// In mock mode the same API is served from built-in golden-path data, with local mutations.
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "./supabase";
import { EVENT_ID, USE_MOCKS } from "./config";
import { mockTables } from "./mocks";
import type { Tables, TableName } from "./types";

type Row = { id: string; created_at?: string; event_id?: string };
type Entry = { rows: Row[]; loaded: boolean; listeners: Set<() => void>; channel?: RealtimeChannel; started: boolean };

const store = new Map<TableName, Entry>();
let mock = USE_MOCKS ? mockTables() : null;

const HAS_CREATED_AT: TableName[] = ["reports", "signals", "alerts", "assignments", "drafts", "agent_log"];
const newestFirst = (a: Row, b: Row) => (b.created_at ?? "").localeCompare(a.created_at ?? "");
const mine = (t: TableName, r: Row) => (t === "events" ? r.id === EVENT_ID : r.event_id === EVENT_ID);

function entry(t: TableName): Entry {
  let e = store.get(t);
  if (!e) store.set(t, (e = { rows: [], loaded: false, listeners: new Set(), started: false }));
  return e;
}

function set(t: TableName, rows: Row[]) {
  const e = entry(t);
  e.rows = HAS_CREATED_AT.includes(t) ? [...rows].sort(newestFirst) : rows;
  e.loaded = true;
  e.listeners.forEach((l) => l());
}

async function fetchTable(t: TableName) {
  if (mock) return set(t, mock[t] as Row[]);
  const q = sb!.from(t).select("*");
  const { data, error } = await (t === "events" ? q.eq("id", EVENT_ID) : q.eq("event_id", EVENT_ID));
  if (error) return console.warn(`[store] fetch ${t}:`, error.message);
  set(t, (data ?? []) as Row[]);
}

function start(t: TableName) {
  const e = entry(t);
  if (e.started) return;
  e.started = true;
  fetchTable(t);
  if (mock) return;
  e.channel = sb!
    .channel(`live-${t}`)
    .on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => {
      const cur = entry(t).rows;
      if (p.eventType === "DELETE") return set(t, cur.filter((r) => r.id !== (p.old as Row).id));
      const row = p.new as Row;
      if (!mine(t, row)) return;
      const exists = cur.some((r) => r.id === row.id);
      set(t, exists ? cur.map((r) => (r.id === row.id ? row : r)) : [row, ...cur]);
    })
    // Re-fetch on every (re)connect so a phone that dropped off Wi-Fi catches up.
    .subscribe((status) => { if (status === "SUBSCRIBED") fetchTable(t); });
}

/** Re-fetch every table in use (after Reset demo, or when the app returns to the foreground). */
export function refetchAll() {
  if (mock) mock = mockTables();
  store.forEach((e, t) => e.started && fetchTable(t));
}
AppState.addEventListener("change", (s) => { if (s === "active") refetchAll(); });

/** Live rows of one table, newest first. Every screen using the same table shares one subscription. */
export function useTable<K extends TableName>(t: K): Tables[K][] {
  return useSyncExternalStore(
    (cb) => { const e = entry(t); e.listeners.add(cb); start(t); return () => e.listeners.delete(cb); },
    () => entry(t).rows,
  ) as unknown as Tables[K][];
}

export function useLoaded(t: TableName): boolean {
  return useSyncExternalStore(
    (cb) => { const e = entry(t); e.listeners.add(cb); start(t); return () => e.listeners.delete(cb); },
    () => entry(t).loaded,
  );
}

export function getRows<K extends TableName>(t: K): Tables[K][] {
  return entry(t).rows as unknown as Tables[K][];
}

/** Mock mode only: apply a local change as if the server had written it. */
export function mockWrite<K extends TableName>(t: K, fn: (rows: Tables[K][]) => Tables[K][]) {
  if (!mock) return;
  (mock[t] as Tables[K][]) = fn(mock[t] as Tables[K][]);
  set(t, mock[t] as Row[]);
}
export const mockInsert = <K extends TableName>(t: K, row: Tables[K]) => mockWrite(t, (rows) => [row, ...rows]);
export const mockUpdate = <K extends TableName>(t: K, id: string, patch: Partial<Tables[K]>) =>
  mockWrite(t, (rows) => rows.map((r) => ((r as Row).id === id ? { ...r, ...patch } : r)));
