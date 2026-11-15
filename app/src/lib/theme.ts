// SafeAssembly style guide: calm, civic, trustworthy. Never police red as the brand.
export const C = {
  deepTeal: "#0E3B38",
  teal: "#0E6B66",
  mint: "#5FD3C4",
  ground: "#F5F6F3",
  ink: "#10201E",
  muted: "#4E5B58",
  line: "#DDE2DF",
  tint: "#E3F1EF",
  white: "#FFFFFF",
  ok: "#1E7A46",
  okBg: "#E6F2EA",
  warning: "#C98A12",
  warningBg: "#FCE7B5",
  warningInk: "#7A5208",
  critical: "#B42318",
  criticalBg: "#FBE9E7",
  // Scenario Injector (dark operator screen)
  night: "#121A19",
  nightCard: "#1E2A28",
  nightLine: "#2E3D3A",
};

export const S = { pad: 16, radius: 16, gap: 12, btn: 44, marshalBtn: 56 };

export const F = {
  title: "SpaceGrotesk_700Bold",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

// Severity is ALWAYS shown with a word (OK / WARNING / CRITICAL), never colour alone.
export type SeverityWord = "OK" | "WARNING" | "CRITICAL";
export const severityWord = (sev: number): SeverityWord => (sev >= 3 ? "CRITICAL" : sev === 2 ? "WARNING" : "OK");
export const SEVERITY_STYLE: Record<SeverityWord, { bg: string; fg: string; border: string }> = {
  OK: { bg: C.okBg, fg: C.ok, border: C.ok },
  WARNING: { bg: C.warningBg, fg: C.warningInk, border: C.warning },
  CRITICAL: { bg: C.critical, fg: C.white, border: C.critical },
};

export const T = {
  screenTitle: { fontFamily: F.title, fontSize: 28, color: C.ink, letterSpacing: -0.3 },
  marshalInstruction: { fontFamily: F.bold, fontSize: 20, lineHeight: 27, color: C.ink },
  cardTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.ink },
  muted: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.8, color: C.muted, textTransform: "uppercase" as const },
};
