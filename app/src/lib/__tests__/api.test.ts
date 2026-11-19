// Every write the app makes, in both demo-data mode and live mode (fake Supabase + fake fetch).
import * as config from "../config";
import * as supabase from "../supabase";
import * as api from "../api";
import { getRows, mockWrite, refetchAll } from "../store";
import { mockTables } from "../mocks";
import { DEFAULT_CAUSE, markUsed } from "../cause";
import type { Draft } from "../types";

const cfg = config as { -readonly [K in keyof typeof config]: (typeof config)[K] };
const sbHolder = supabase as unknown as { sb: unknown };

// ---- Fakes for live mode ----

type Call = { table: string; op: string; payload?: unknown; eq?: [string, unknown] };
let dbCalls: Call[] = [];
let dbError: string | null = null;
const fakeSb = {
  from: (table: string) => ({
    insert: async (payload: unknown) => { dbCalls.push({ table, op: "insert", payload }); return { error: dbError ? { message: dbError } : null }; },
    update: (payload: unknown) => ({
      eq: async (c: string, v: unknown) => { dbCalls.push({ table, op: "update", payload, eq: [c, v] }); return { error: dbError ? { message: dbError } : null }; },
    }),
  }),
};

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const lastFetch = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, method: init.method as string, body: init.body ? JSON.parse(init.body) : undefined };
};

beforeEach(() => {
  dbCalls = [];
  dbError = null;
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cfg.USE_MOCKS = true;
  sbHolder.sb = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  refetchAll();
});
function liveMode() {
  cfg.USE_MOCKS = false;
  sbHolder.sb = fakeSb;
}

const draft = { id: "d-1" } as Draft;

// ---- Demo-data mode ----

describe("demo-data mode (no backend)", () => {
  // Tables load when a screen first subscribes; load them here as a screen would.
  beforeEach(() => (["reports", "drafts", "alerts", "assignments"] as const).forEach((t) => mockWrite(t, (rows) => rows)));

  it("a marshal report is added locally with zone and level only, and nothing hits the network", async () => {
    const before = mockTables().reports.length;
    await api.sendReport("barrington_exit", "crowd", 5);
    const [r] = getRows("reports");
    expect(getRows("reports")).toHaveLength(before + 1);
    expect(r).toMatchObject({ zone_id: "barrington_exit", type: "crowd", level: 5 });
    expect(Object.keys(r).sort()).toEqual(["created_at", "event_id", "id", "level", "note", "type", "zone_id"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("approve, reject, resolve and acknowledge update local rows", async () => {
    const [d1, d2] = getRows("drafts");
    await api.approveDraft(d1, { body_en: "Edited" });
    await api.rejectDraft(d2);
    const alert = getRows("alerts").find((a) => a.status === "open")!;
    await api.resolveAlert(alert.id);
    const asg = getRows("assignments").find((a) => !a.acknowledged)!;
    await api.acknowledge(asg.id);

    const byId = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;
    expect(byId(getRows("drafts"), d1.id)).toMatchObject({ status: "approved", body_en: "Edited" });
    expect(byId(getRows("drafts"), d1.id).decided_at).toBeTruthy();
    expect(byId(getRows("drafts"), d2.id).status).toBe("rejected");
    expect(byId(getRows("alerts"), alert.id).status).toBe("handled");
    expect(byId(getRows("assignments"), asg.id).acknowledged).toBe(true);
  });

  it("agent calls return built-in answers after a short delay", async () => {
    jest.useFakeTimers();
    const p = api.askRights("Can I film police?", "en");
    jest.advanceTimersByTime(1200);
    expect((await p).disclaimer).toBe("General information, not legal advice.");

    const plan = api.generatePlan({});
    jest.advanceTimersByTime(1500);
    expect((await plan).permit_markdown).toMatch(/Draft only/);

    expect((await api.markSubmitted()).submitted).toBe(true);
    expect((await api.health()).gemini).toBe("cache-only");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---- Live mode ----

describe("live mode", () => {
  beforeEach(liveMode);

  it("a marshal report goes to Supabase, then pings /tick without waiting for it", async () => {
    fetchMock.mockReturnValue(reply(200, { alerts: 1 }));
    await api.sendReport("stage", "medical");
    expect(dbCalls).toEqual([{ table: "reports", op: "insert", payload: { event_id: cfg.EVENT_ID, zone_id: "stage", type: "medical", level: null } }]);
    expect(lastFetch()).toMatchObject({ url: "http://api.test/tick", method: "POST" });
  });

  it("a failed report insert throws and does not tick", async () => {
    dbError = "permission denied";
    await expect(api.sendReport("stage", "crowd", 3)).rejects.toThrow("permission denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failed tick never breaks the marshal's report", async () => {
    fetchMock.mockReturnValue(Promise.reject(new Error("offline")));
    await expect(api.sendReport("stage", "crowd", 3)).resolves.toBeUndefined();
  });

  it("acknowledge updates only that assignment", async () => {
    await api.acknowledge("as-9");
    expect(dbCalls).toEqual([{ table: "assignments", op: "update", payload: { acknowledged: true }, eq: ["id", "as-9"] }]);
  });

  it("approvals go through the server so every decision is logged", async () => {
    fetchMock.mockReturnValue(reply(200, {}));
    await api.approveDraft(draft, { body_fr: "FR" });
    expect(lastFetch()).toEqual({ url: "http://api.test/drafts/d-1/approve", method: "POST", body: { body_fr: "FR" } });
    await api.rejectDraft(draft);
    expect(lastFetch().url).toBe("http://api.test/drafts/d-1/reject");
    await api.resolveAlert("al-1");
    expect(lastFetch().url).toBe("http://api.test/alerts/al-1/resolve");
  });

  it("agent routes post the right bodies", async () => {
    fetchMock.mockReturnValue(reply(200, {}));
    await api.askRights("Faut-il un permis ?", "fr");
    expect(lastFetch()).toMatchObject({ url: "http://api.test/rights", body: { question: "Faut-il un permis ?", lang: "fr" } });
    await api.generatePlan({ name: "Vigil" });
    expect(lastFetch()).toMatchObject({ url: "http://api.test/plan", body: { name: "Vigil" } });
    await api.generateReport();
    expect(lastFetch().url).toBe("http://api.test/report");
    await api.inject("crowd5");
    expect(lastFetch().url).toBe("http://api.test/inject/crowd5");
    await api.injectPaste("A post");
    expect(lastFetch()).toMatchObject({ url: "http://api.test/inject/paste", body: { text: "A post" } });
    await api.resetDemo();
    expect(lastFetch().url).toBe("http://api.test/reset");
  });

  it("GET /health is the only GET", async () => {
    fetchMock.mockReturnValue(reply(200, { ok: true }));
    await api.health();
    expect(lastFetch()).toMatchObject({ url: "http://api.test/health", method: "GET", body: undefined });
  });

  it("server errors surface the server's message, or the status code", async () => {
    fetchMock.mockReturnValueOnce(reply(409, { error: "Draft already approved" }));
    await expect(api.approveDraft(draft)).rejects.toThrow("Draft already approved");
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 502, json: async () => { throw new Error("html"); } }));
    await expect(api.approveDraft(draft)).rejects.toThrow("Server error 502");
  });

  it("a sleeping server gives a friendly timeout message", async () => {
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_, rej) =>
      init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    jest.useFakeTimers();
    const p = api.approveDraft(draft);
    jest.advanceTimersByTime(45_000);
    await expect(p).rejects.toThrow("The agent server didn't answer in time. Is it awake?");
  });

  it("with no server URL configured, calls fail clearly", async () => {
    const url = cfg.API_URL;
    cfg.API_URL = "";
    await expect(api.rejectDraft(draft)).rejects.toThrow("EXPO_PUBLIC_API_URL is not set");
    cfg.API_URL = url;
  });
});

// ---- Participant email ----

describe("draftEmail", () => {
  const mayor = DEFAULT_CAUSE.contacts[0];
  const ev = { name: "Vigil", place: "Grand Parade", time: "6 PM" };

  it("uses the AI draft when the server returns one, sending only public, size-limited context", async () => {
    liveMode();
    fetchMock.mockReturnValue(reply(200, { subject: "S", body: "A fresh AI body" }));
    const previous = [{ subject: "s", body: "x".repeat(500), source: "phone" as const }];
    const d = await api.draftEmail(DEFAULT_CAUSE, mayor, ev, previous);
    expect(d).toEqual({ subject: "S", body: "A fresh AI body", source: "gemini" });
    const { body } = lastFetch();
    expect(body.to).toEqual({ title: mayor.title, office: mayor.office, salutation: mayor.salutation });
    expect(body.avoid[0]).toHaveLength(300);
  });

  it("falls back to the on-phone writer when the server fails or rate-limits", async () => {
    liveMode();
    fetchMock.mockReturnValue(reply(429, { error: "Too many drafts" }));
    const d = await api.draftEmail(DEFAULT_CAUSE, mayor, ev, []);
    expect(d.source).toBe("phone");
    expect(d.body).toContain("Dear Mayor");
  });

  it("rejects an AI draft this phone has already produced", async () => {
    liveMode();
    await markUsed({ body: "Same old body" });
    fetchMock.mockReturnValue(reply(200, { subject: "S", body: "Same old body" }));
    expect((await api.draftEmail(DEFAULT_CAUSE, mayor, ev, [])).source).toBe("phone");
  });

  it("demo-data mode never calls the server", async () => {
    const d = await api.draftEmail(DEFAULT_CAUSE, mayor, ev, []);
    expect(d.source).toBe("phone");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
