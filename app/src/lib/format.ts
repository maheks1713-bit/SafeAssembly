import { useEffect, useState } from "react";
import type { Alert, Signal, Volunteer, ReportRow, ZoneId } from "./types";

export const ZONE_NAME: Record<string, string> = {
  stage: "Stage", main_square: "Main Square", barrington_exit: "Barrington Exit", all: "all zones",
};
export const RISK_LABEL: Record<string, string> = {
  choke_point: "Choke point", overcrowding: "Overcrowding", medical: "Medical", blocked_exit: "Exit blocked",
  cold_wind_stress: "Cold stress", heat_stress: "Heat stress", dispersal_risk: "Dispersal risk",
};
export const alertTitle = (a: Pick<Alert, "risk_type" | "zone_id">) =>
  `${RISK_LABEL[a.risk_type] ?? a.risk_type}${a.zone_id === "all" ? ", all zones" : ` at ${ZONE_NAME[a.zone_id] ?? a.zone_id}`}`;

export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Re-render every `ms` so "2 min ago" labels and the LIVE timer stay fresh. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export type Weather = { temp: number; feels: number; wind: number; forced: boolean };
export function latestWeather(signals: Signal[]): Weather | null {
  const w = signals.find((s) => s.source === "weather");
  if (!w) return null;
  const p = w.payload_json;
  return { temp: Math.round(p.temperature_2m), feels: Math.round(p.apparent_temperature), wind: Math.round(p.wind_speed_10m), forced: Boolean(p.forced) };
}
export const fmtTemp = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n)}°`;

export type ZoneStatus = "OK" | "Busy" | "Critical";
/** Zone colour from open alerts (and the latest crowd report): severity 3 -> Critical, 2 or crowd 3+ -> Busy. */
export function zoneStatus(zone: ZoneId, alerts: Alert[], reports: ReportRow[]): ZoneStatus {
  const open = alerts.filter((a) => a.status === "open" && a.zone_id === zone);
  if (open.some((a) => a.severity >= 3)) return "Critical";
  if (open.some((a) => a.severity === 2)) return "Busy";
  const lastCrowd = reports.find((r) => r.zone_id === zone && r.type === "crowd");
  if (lastCrowd && (lastCrowd.level ?? 0) >= 3 && Date.now() - new Date(lastCrowd.created_at).getTime() < 15 * 60_000) return "Busy";
  return "OK";
}

export const callsigns = (ids: string[], vols: Volunteer[]) =>
  ids.map((id) => vols.find((v) => v.id === id)?.callsign).filter(Boolean) as string[];

export const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
