// Local notifications (work in Expo Go). Remote push needs a development build: roadmap item.
import { useEffect, useRef } from "react";
import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import type { Assignment } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function setupNotifications() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("dispatch", {
        name: "Dispatcher instructions",
        // eslint-disable-next-line import/namespace -- TS enum; verified by tsc
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
      });
    }
    await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.warn("[notifications]", (e as Error).message);
  }
}

/** Buzz this phone when a NEW assignment for this volunteer arrives (not for ones that existed on open). */
export function useAssignmentAlerts(mine: Assignment[], volunteerId: string | undefined) {
  const seen = useRef<Set<string> | null>(null);
  const forVolunteer = useRef(volunteerId);

  useEffect(() => {
    if (forVolunteer.current !== volunteerId) { seen.current = null; forVolunteer.current = volunteerId; }
    if (seen.current === null) { seen.current = new Set(mine.map((a) => a.id)); return; }
    for (const a of mine) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      Vibration.vibrate([0, 400, 200, 400]);
      Notifications.scheduleNotificationAsync({
        content: { title: "New instruction from Dispatcher", body: a.instruction, sound: true },
        trigger: Platform.OS === "android" ? { channelId: "dispatch" } : null,
      }).catch(() => {});
    }
  }, [mine, volunteerId]);
}
