// Which volunteer this phone is. No login (cut from MVP): the marshal picks their callsign.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "safeassembly.callsign";
let callsign = "M4";
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY).then((v) => { if (v) setCallsign(v); }).catch(() => {});

export function setCallsign(c: string) {
  callsign = c;
  AsyncStorage.setItem(KEY, c).catch(() => {});
  listeners.forEach((l) => l());
}

export function useCallsign(): string {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => callsign);
}
