import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import { setCallsign, useCallsign } from "../session";
import { useAssignmentAlerts } from "../notifications";
import type { Assignment } from "../types";

describe("callsign session", () => {
  it("defaults to M4 (the golden-path marshal)", async () => {
    const { result } = await renderHook(() => useCallsign());
    expect(result.current).toBe("M4");
  });

  it("changing callsign re-renders every screen and is remembered on the phone", async () => {
    const { result } = await renderHook(() => useCallsign());
    await act(() => setCallsign("Medic-1"));
    expect(result.current).toBe("Medic-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(await AsyncStorage.getItem("safeassembly.callsign")).toBe("Medic-1");
  });
});

describe("useAssignmentAlerts (marshal phone buzz)", () => {
  const asg = (id: string, instruction = "Move now"): Assignment =>
    ({ id, event_id: "e", volunteer_id: "v4", zone_id: "barrington_exit", instruction, alert_id: null, acknowledged: false, created_at: "", kind: "move" });

  let vibrate: jest.SpyInstance;
  let notify: jest.SpyInstance;
  beforeEach(() => {
    vibrate = jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
    notify = jest.spyOn(Notifications, "scheduleNotificationAsync").mockResolvedValue("n");
    vibrate.mockClear(); // both are pre-existing jest.fn stubs: start each test at zero calls
    notify.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("stays quiet for instructions that already existed when the app opened", async () => {
    await renderHook(() => useAssignmentAlerts([asg("a1"), asg("a2")], "v4"));
    expect(vibrate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("buzzes once per new instruction, with its text", async () => {
    const { rerender } = await renderHook(({ mine }: { mine: Assignment[] }) => useAssignmentAlerts(mine, "v4"), { initialProps: { mine: [asg("a1")] } });
    await rerender({ mine: [asg("a2", "Hold the line"), asg("a1")] });
    await rerender({ mine: [asg("a2", "Hold the line"), asg("a1")] });
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].content).toMatchObject({ title: "New instruction from Dispatcher", body: "Hold the line" });
  });

  it("switching callsign doesn't buzz for the new volunteer's old instructions", async () => {
    const { rerender } = await renderHook(({ mine, id }: { mine: Assignment[]; id: string }) => useAssignmentAlerts(mine, id), { initialProps: { mine: [asg("a1")], id: "v4" } });
    await rerender({ mine: [asg("b1"), asg("b2")], id: "v7" });
    expect(vibrate).not.toHaveBeenCalled();
  });
});
