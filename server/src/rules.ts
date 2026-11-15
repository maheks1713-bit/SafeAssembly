// Monitor Agent rules: deterministic, so the demo never surprises you. Gemini only writes the explanation.

export type Report = { zone_id: string; type: string; level: number | null; created_at: string };
export type Zone = { id: string; name: string; has_exit: boolean };
export type Wx = { apparent_temperature: number; wind_speed_10m: number; created_at: string } | null;
export type TransitSignal = { text: string; created_at: string };
export type ExistingAlert = { zone_id: string; risk_type: string; status: string; created_at: string };

export type Severity = 1 | 2 | 3;
export type RawAlert = {
  zone_id: string;
  risk_type: string;
  severity: Severity;
  facts: string;
  /** When the evidence for this alert arrived. Used to avoid re-raising a handled alert. */
  since: string;
};

export function monitorRules(
  reports: Report[],
  zones: Zone[],
  wx: Wx,
  transit: TransitSignal[],
  existing: ExistingAlert[],
): RawAlert[] {
  const out: RawAlert[] = [];
  const add = (zone_id: string, risk_type: string, severity: Severity, facts: string, since: string) =>
    out.push({ zone_id, risk_type, severity, facts, since });

  for (const r of reports) {
    const z = zones.find((z) => z.id === r.zone_id);
    if (!z) continue;
    if (r.type === "crowd" && (r.level ?? 0) >= 4) {
      if (z.has_exit) add(z.id, "choke_point", 3, `crowd level ${r.level} reported at exit zone ${z.name} (the only east exit)`, r.created_at);
      else add(z.id, "overcrowding", 2, `crowd level ${r.level} reported in ${z.name}`, r.created_at);
    }
    if (r.type === "medical") add(z.id, "medical", 3, `medical help requested in ${z.name}`, r.created_at);
    if (r.type === "blocked_exit") add(z.id, "blocked_exit", 3, `exit reported blocked at ${z.name}`, r.created_at);
  }

  if (wx && (wx.apparent_temperature < -10 || wx.wind_speed_10m > 50))
    add("all", "cold_wind_stress", 2, `feels like ${wx.apparent_temperature}C, wind ${wx.wind_speed_10m} km/h (Open-Meteo)`, wx.created_at);
  if (wx && wx.apparent_temperature > 30)
    add("all", "heat_stress", 2, `feels like ${wx.apparent_temperature}C (Open-Meteo)`, wx.created_at);

  for (const t of transit) add("barrington_exit", "dispersal_risk", 1, t.text, t.created_at);

  return dedupe(out, existing);
}

/** Skip an alert if the same zone + risk is already open, or was raised after this evidence arrived. */
export function dedupe(raw: RawAlert[], existing: ExistingAlert[]): RawAlert[] {
  const kept: RawAlert[] = [];
  for (const a of raw) {
    const same = (e: { zone_id: string; risk_type: string }) => e.zone_id === a.zone_id && e.risk_type === a.risk_type;
    if (kept.some(same)) continue;
    if (existing.some((e) => same(e) && (e.status === "open" || e.created_at >= a.since))) continue;
    kept.push(a);
  }
  return kept;
}

// ---- Dispatcher picking (code chooses people, Gemini only words the instruction) ----

export type Volunteer = { id: string; callsign: string; role: string; zone_id: string | null; status: string };
export type Alert = { id?: string; zone_id: string; risk_type: string; severity: number };

export const NEED: Record<string, { role: string; n: number }[]> = {
  choke_point: [{ role: "marshal", n: 2 }],
  overcrowding: [{ role: "marshal", n: 1 }],
  medical: [{ role: "medic", n: 1 }],
  blocked_exit: [{ role: "marshal", n: 2 }],
  cold_wind_stress: [{ role: "medic", n: 1 }],
  heat_stress: [{ role: "medic", n: 1 }],
};

/** "Nearest" = same zone, then adjacent zones. Hard-coded for the 3 golden-path zones. */
export const ADJ: Record<string, string[]> = {
  stage: ["main_square"],
  main_square: ["stage", "barrington_exit"],
  barrington_exit: ["main_square"],
};

/** Where a volunteer is sent for an alert. Event-wide weather alerts go to the warming/cooling tent at Stage. */
export const targetZone = (a: Alert) => (a.zone_id === "all" ? "stage" : a.zone_id);

export function pickVolunteers(vols: Volunteer[], alert: Alert): Volunteer[] {
  const target = targetZone(alert);
  const order = [target, ...(ADJ[target] ?? []), ...Object.keys(ADJ)];
  const rank = (v: Volunteer) => {
    const i = order.indexOf(v.zone_id ?? "");
    return i === -1 ? 99 : i;
  };
  const chosen: Volunteer[] = [];
  for (const { role, n } of NEED[alert.risk_type] ?? []) {
    chosen.push(
      ...vols
        .filter((v) => v.role === role && v.status === "free" && !chosen.includes(v))
        // Marshals already in the alert zone stay put to hold the line (e.g. M4 at Barrington Exit).
        .filter((v) => !(role === "marshal" && v.zone_id === alert.zone_id))
        .sort((a, b) => rank(a) - rank(b) || a.callsign.localeCompare(b.callsign))
        .slice(0, n),
    );
  }
  return chosen;
}

/** Marshals already in the zone who should hold position for exit/crowd alerts. */
export function holders(vols: Volunteer[], alert: Alert): Volunteer[] {
  if (!["choke_point", "blocked_exit", "overcrowding"].includes(alert.risk_type)) return [];
  return vols.filter((v) => v.role === "marshal" && v.zone_id === alert.zone_id);
}

/** 911 escalation is decided by a rule, never by the model. A human still makes the call. */
export const needs911 = (a: Alert) => a.severity === 3 && (a.risk_type === "medical" || a.risk_type === "blocked_exit");
