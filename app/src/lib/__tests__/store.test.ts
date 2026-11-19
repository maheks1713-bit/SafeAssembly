// The shared live-table store, in demo-data mode (no Supabase).
import { act, renderHook } from "@testing-library/react-native";
import { getRows, mockInsert, mockUpdate, refetchAll, useLoaded, useTable } from "../store";
import type { ReportRow } from "../types";

const report = (id: string, created_at: string): ReportRow =>
  ({ id, event_id: "00000000-0000-4000-8000-000000000001", zone_id: "stage", type: "crowd", level: 3, note: null, created_at });

afterEach(() => act(() => refetchAll()));

describe("useTable in demo-data mode", () => {
  it("loads the golden-path rows on first use", async () => {
    const { result } = await renderHook(() => ({ zones: useTable("zones"), loaded: useLoaded("zones") }));
    expect(result.current.loaded).toBe(true);
    expect(result.current.zones).toHaveLength(3);
  });

  it("timestamped tables are sorted newest first", async () => {
    const { result } = await renderHook(() => useTable("agent_log"));
    const times = result.current.map((l) => l.created_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("screens re-render when a row is inserted, and the new row sorts to the top", async () => {
    const { result } = await renderHook(() => useTable("reports"));
    const before = result.current.length;
    await act(() => mockInsert("reports", report("new", new Date(Date.now() + 1000).toISOString())));
    expect(result.current).toHaveLength(before + 1);
    expect(result.current[0].id).toBe("new");
  });

  it("mockUpdate patches one row and leaves the others alone", async () => {
    const { result } = await renderHook(() => useTable("drafts"));
    const [first, second] = result.current;
    await act(() => mockUpdate("drafts", first.id, { status: "approved" }));
    expect(result.current.find((d) => d.id === first.id)?.status).toBe("approved");
    expect(result.current.find((d) => d.id === second.id)?.status).toBe(second.status);
  });

  it("two screens using the same table share one copy of the rows", async () => {
    const a = await renderHook(() => useTable("volunteers"));
    const b = await renderHook(() => useTable("volunteers"));
    expect(a.result.current).toBe(b.result.current);
    expect(getRows("volunteers")).toBe(a.result.current);
  });

  it("refetchAll (Reset demo) restores the starting data", async () => {
    const { result } = await renderHook(() => useTable("alerts"));
    const original = result.current.length;
    await act(() => mockInsert("alerts", { ...result.current[0], id: "extra" }));
    expect(result.current).toHaveLength(original + 1);
    await act(() => refetchAll());
    expect(result.current).toHaveLength(original);
  });
});
