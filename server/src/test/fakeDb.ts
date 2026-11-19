// In-memory stand-in for the Supabase client, just big enough for the queries the server makes.
// `installFakeDb()` swaps `sb.from` for this fake, so agents, routes and the tick run against
// plain arrays and tests can assert on exactly what was written. Nothing touches the network.
import { sb } from "../supabase";

type Row = Record<string, any>;
type Filter = (r: Row) => boolean;
type Result = { data: any; error: { message: string } | null };

let seq = 0;
let clock = Date.now();
/** Strictly increasing ISO timestamps, so "newest" ordering is deterministic. */
export const nextTime = () => new Date(++clock).toISOString();

const get = (r: Row, col: string) => {
  // Supports the JSON path form used by the weather poller: payload_json->>forced
  const [base, key] = col.split("->>");
  const v = r[base];
  return key === undefined ? v : v?.[key] === undefined ? undefined : String(v[key]);
};

/** Column defaults from sql/schema.sql, applied on insert like Postgres would. */
const DEFAULTS: Record<string, Row> = {
  events: { status: "live" },
  zones: { capacity_level: 1, has_exit: false },
  volunteers: { status: "free" },
  signals: { processed: false },
  alerts: { status: "open" },
  assignments: { acknowledged: false, kind: "move" },
  drafts: { status: "pending", meta: {} },
};
const withDefaults = (t: string, r: Row): Row => ({ id: `${t}-${++seq}`, created_at: nextTime(), ...structuredClone(DEFAULTS[t] ?? {}), ...r });

export class FakeDb {
  tables: Record<string, Row[]> = {};
  failures: { table: string; op: string; message: string }[] = [];

  rows(t: string): Row[] {
    return (this.tables[t] ??= []);
  }
  seed(t: string, rows: Row[]) {
    this.rows(t).push(...rows.map((r) => withDefaults(t, r)));
  }
  /** Make the next `op` on `table` return a Supabase-style error. */
  failNext(table: string, op: "select" | "insert" | "update" | "delete" | "upsert", message = "boom") {
    this.failures.push({ table, op, message });
  }
  from(t: string) {
    return new Query(this, t);
  }
}

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private returning = false;
  private values: Row[] = [];
  private patch: Row = {};
  private filters: Filter[] = [];
  private sort?: { col: string; asc: boolean };
  private max?: number;
  private one: "single" | "maybe" | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string) {
    if (this.op === "select") return this;
    this.returning = true;
    return this;
  }
  insert(v: Row | Row[]) { this.op = "insert"; this.values = Array.isArray(v) ? v : [v]; return this; }
  upsert(v: Row | Row[]) { this.op = "upsert"; this.values = Array.isArray(v) ? v : [v]; return this; }
  update(p: Row) { this.op = "update"; this.patch = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => get(r, col) === v); return this; }
  neq(col: string, v: unknown) { this.filters.push((r) => get(r, col) !== v); return this; }
  gte(col: string, v: string) { this.filters.push((r) => get(r, col) >= v); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(get(r, col))); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.sort = { col, asc: o?.ascending ?? true }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }

  private run(): Result {
    const fail = this.db.failures.findIndex((f) => f.table === this.table && f.op === this.op);
    if (fail !== -1) {
      const [f] = this.db.failures.splice(fail, 1);
      return { data: null, error: { message: f.message } };
    }
    const all = this.db.rows(this.table);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];

    switch (this.op) {
      case "select": {
        out = all.filter(match);
        if (this.sort) {
          const { col, asc } = this.sort;
          out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
        }
        if (this.max !== undefined) out = out.slice(0, this.max);
        return this.shape(out, true);
      }
      case "insert":
        out = this.values.map((v) => withDefaults(this.table, structuredClone(v)));
        all.push(...out);
        break;
      case "upsert":
        for (const v of this.values) {
          const i = all.findIndex((r) => r.id === v.id);
          const row = { created_at: nextTime(), ...(i === -1 ? {} : all[i]), ...structuredClone(v) };
          if (i === -1) all.push(row); else all[i] = row;
          out.push(row);
        }
        break;
      case "update":
        for (const r of all.filter(match)) { Object.assign(r, structuredClone(this.patch)); out.push(r); }
        break;
      case "delete":
        out = all.filter(match);
        this.db.tables[this.table] = all.filter((r) => !match(r));
        break;
    }
    return this.returning ? this.shape(out, false) : { data: null, error: null };
  }

  private shape(rows: Row[], isSelect: boolean): Result {
    const copy = rows.map((r) => structuredClone(r));
    if (this.one === null) return { data: copy, error: null };
    if (copy.length === 1) return { data: copy[0], error: null };
    if (this.one === "maybe" && copy.length === 0) return { data: null, error: null };
    return { data: null, error: { message: `${isSelect ? "select" : this.op} returned ${copy.length} rows, expected 1` } };
  }
}

/** Point the shared service-role client at a fresh in-memory database. */
export function installFakeDb(): FakeDb {
  const db = new FakeDb();
  (sb as unknown as { from: (t: string) => Query }).from = (t: string) => db.from(t);
  return db;
}

export const ZONES = [
  { id: "stage", name: "Stage", has_exit: false },
  { id: "main_square", name: "Main Square", has_exit: false },
  { id: "barrington_exit", name: "Barrington Exit", has_exit: true },
];

/** The seeded golden-path volunteers (M1 busy at the info table). */
export const VOLUNTEERS = [
  { id: "v1", callsign: "M1", role: "marshal", zone_id: "main_square", status: "busy" },
  { id: "v2", callsign: "M2", role: "marshal", zone_id: "main_square", status: "free" },
  { id: "v3", callsign: "M3", role: "marshal", zone_id: "stage", status: "free" },
  { id: "v4", callsign: "M4", role: "marshal", zone_id: "barrington_exit", status: "free" },
  { id: "v5", callsign: "M5", role: "marshal", zone_id: "main_square", status: "free" },
  { id: "v6", callsign: "M6", role: "marshal", zone_id: "stage", status: "free" },
  { id: "v7", callsign: "Medic-1", role: "medic", zone_id: "stage", status: "free" },
  { id: "v8", callsign: "Medic-2", role: "medic", zone_id: "main_square", status: "free" },
  { id: "v9", callsign: "Legal-1", role: "legal_observer", zone_id: "main_square", status: "free" },
];

/** A database holding the golden-path event, zones and volunteers. */
export function seedGolden(db: FakeDb, eventId: string, facts: Record<string, unknown> = {}) {
  db.seed("events", [{ id: eventId, name: "Halifax Climate Vigil", location: "Grand Parade", expected_size: 800, status: "live", facts_json: facts }]);
  db.seed("zones", ZONES.map((z) => ({ ...z, event_id: eventId })));
  db.seed("volunteers", VOLUNTEERS.map((v) => ({ ...v, event_id: eventId })));
}

/** agent_log rows as "Agent:action" strings, oldest first. */
export const logTrail = (db: FakeDb) => db.rows("agent_log").map((l) => `${l.agent}:${l.action}`);
