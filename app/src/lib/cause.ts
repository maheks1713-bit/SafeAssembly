// Participant role: why the event is happening, what to ask for, who to contact, and a
// no-AI email writer (used in demo-data mode, offline, or when the Gemini quota is used up).
//
// CONTENT LANE: check every phone number, email and link below before the demo, then tick:
// Checked: [x]
// Only public office channels belong here (never a person's private phone or email).
// An event can override all of this with events.facts_json.cause.
// Set action_needed to false for an event where just showing up is enough.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Cause, Contact, EmailDraft } from "./types";

export const DEFAULT_CAUSE: Cause = {
  about:
    "A peaceful candlelight vigil for climate action. We gather to remember what Nova Scotia has already lost to storms, floods and wildfires, and to ask our leaders for a clear plan to protect people here.",
  why: [
    "Recent storms, flooding and wildfire smoke have hit Halifax-area communities hard.",
    "Coastal neighbourhoods face more flooding as sea levels rise.",
    "Leaders listen when many people show they care, calmly and together.",
  ],
  ask: "a clear, funded plan to cut emissions and protect Halifax communities from floods, storms and extreme heat",
  action_needed: true,
  contacts: [
    {
      id: "mayor", title: "Mayor of Halifax", office: "Halifax Regional Municipality", salutation: "Dear Mayor",
      email: "mayor@halifax.ca", phone: "902-490-4000",
    },
    {
      id: "councillor", title: "Your Halifax councillor", office: "Halifax Regional Council", salutation: "Dear Councillor",
      phone: "902-490-4000",
      lookup_url: "https://www.halifax.ca/city-hall/districts-councillors", lookup_label: "Find your councillor",
    },
    {
      id: "premier", title: "Premier of Nova Scotia", office: "Province of Nova Scotia", salutation: "Dear Premier",
      email: "premier@novascotia.ca", phone: "902-424-6600",
    },
    {
      id: "mla", title: "Your MLA", office: "Nova Scotia House of Assembly", salutation: "Dear Member of the Legislative Assembly",
      lookup_url: "https://nslegislature.ca/members/profiles", lookup_label: "Find your MLA",
    },
    {
      id: "mp", title: "Your Member of Parliament", office: "House of Commons of Canada", salutation: "Dear Member of Parliament",
      lookup_url: "https://www.ourcommons.ca/members/en", lookup_label: "Find your MP by postal code",
    },
  ],
};

// ---------- Angles and tones: picked at random so every draft reads differently ----------

export const ANGLES = [
  "the future children growing up in Halifax will inherit",
  "health: clean air, wildfire smoke and extreme heat",
  "coastal flooding and storm damage in our neighbourhoods",
  "good local jobs in clean energy",
  "the cost of storm repairs to families and the city budget",
  "pride in Nova Scotia leading instead of following",
  "fairness for young people and future generations",
  "protecting the ocean, coastline and fisheries",
  "older neighbours and people most at risk in heat and storms",
  "trust: keeping the promises already made",
];
export const TONES = ["warm and personal", "brief and direct", "hopeful", "formal and respectful", "plain and neighbourly"];
export const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

// ---------- "Never the same email twice" on this phone ----------

const KEY = "safeassembly.emails";
let seen: Set<string> | null = null;

const norm = (s: string) => s.toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const fingerprint = (d: Pick<EmailDraft, "body">) => hash(norm(d.body));

async function loadSeen(): Promise<Set<string>> {
  if (seen) return seen;
  try { seen = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]") as string[]); } catch { seen = new Set(); }
  return seen;
}
export async function isUsed(d: Pick<EmailDraft, "body">) {
  return (await loadSeen()).has(fingerprint(d));
}
export async function markUsed(d: Pick<EmailDraft, "body">) {
  const s = await loadSeen();
  s.add(fingerprint(d));
  AsyncStorage.setItem(KEY, JSON.stringify([...s].slice(-200))).catch(() => {});
}

// ---------- On-phone writer (no AI): thousands of combinations ----------

type Ev = { name: string; place: string; time: string };

const SUBJECTS = [
  (e: Ev) => `A constituent's request after the ${e.name}`,
  () => "Please make a clear climate plan for Halifax a priority",
  () => "Protecting our communities from floods, storms and heat",
  (e: Ev) => `Why I joined the ${e.name}`,
  () => "A request from a resident who cares about climate action",
  () => "Climate action: what I am asking you to support",
  (e: Ev) => `From the ${e.name} at ${e.place}`,
];
const OPENINGS = [
  (e: Ev) => `I'm writing because I'm taking part in the ${e.name} at ${e.place} (${e.time}).`,
  (e: Ev) => `This week I'm joining hundreds of neighbours at the ${e.name} on ${e.place}.`,
  (e: Ev) => `I'm one of the people gathering peacefully at ${e.place} for the ${e.name}, and I wanted you to hear from me directly.`,
  () => "I don't often write to elected officials, but this matters too much to stay quiet.",
  (e: Ev) => `I'll be standing with my community at the ${e.name}, and I'd like my voice to reach you as well.`,
  () => "I'm writing as a resident who wants Halifax to be a safe place to live for decades to come.",
];
const REASONS: Record<string, string[]> = {
  default: [
    "The storms, floods and wildfire smoke of the last few years have shown how exposed our communities are.",
    "Every season seems to bring another storm or flood that costs families money, time and peace of mind.",
    "I worry about what the next big storm or heat wave will mean for the people I love.",
  ],
  future: ["I keep thinking about the Halifax that today's children will inherit, and I want it to be safe and liveable."],
  health: ["Wildfire smoke and extreme heat are already a health risk here, especially for children and older neighbours."],
  flood: ["Coastal flooding and storm damage are no longer rare events in our neighbourhoods."],
  jobs: ["Clean energy can bring good, lasting jobs to Nova Scotia if we plan for it now."],
  cost: ["Repairing storm damage again and again costs families and the city far more than preparing ahead."],
  pride: ["Nova Scotia can lead on this instead of waiting for others to act first."],
  fair: ["Young people did the least to cause this problem and will live longest with it."],
  ocean: ["Our coastline, ocean and fisheries are part of who we are, and they are changing fast."],
  risk: ["Older residents and people without much money are hit hardest by heat and storms."],
  trust: ["Keeping the climate commitments already made would show people that their leaders follow through."],
};
const ANGLE_KEY: Record<string, string> = {
  [ANGLES[0]]: "future", [ANGLES[1]]: "health", [ANGLES[2]]: "flood", [ANGLES[3]]: "jobs", [ANGLES[4]]: "cost",
  [ANGLES[5]]: "pride", [ANGLES[6]]: "fair", [ANGLES[7]]: "ocean", [ANGLES[8]]: "risk", [ANGLES[9]]: "trust",
};
const ASKS = [
  (ask: string) => `I'm asking you to support ${ask}.`,
  (ask: string) => `Please champion ${ask}, and tell residents what the next steps are.`,
  (ask: string) => `Would you commit to ${ask}? Knowing where you stand would mean a lot to me.`,
  (ask: string) => `My request is simple: make ${ask} a priority this year.`,
  (ask: string) => `I hope you will speak up for ${ask}, and share a timeline the public can follow.`,
];
const CLOSINGS = [
  "Thank you for your time and for the work you do for our community.",
  "I would be grateful for a reply letting me know your position.",
  "Thank you for listening. Many of us are paying attention and want to help.",
  "I appreciate your service and hope to hear back from you.",
  "Thank you. I believe we can do this together.",
];
const SIGNOFFS = ["Sincerely", "Respectfully", "With thanks", "Kind regards", "Best regards"];

export async function composeEmail(cause: Cause, contact: Contact, ev: Ev, angle = pick(ANGLES)): Promise<EmailDraft> {
  let draft: EmailDraft | null = null;
  for (let i = 0; i < 40; i++) {
    // One sentence for the chosen angle, plus one general sentence (never the same one twice).
    const first = pick(REASONS[ANGLE_KEY[angle] ?? ""] ?? REASONS.default);
    const second = pick(REASONS.default.filter((r) => r !== first));
    const body = [
      `${contact.salutation},`,
      pick(OPENINGS)(ev),
      `${first} ${second}`,
      pick(ASKS)(cause.ask),
      pick(CLOSINGS),
      `${pick(SIGNOFFS)},\n[Your name]\n[Your neighbourhood or postal code]`,
    ].join("\n\n");
    draft = { subject: pick(SUBJECTS)(ev), body, source: "phone" };
    if (!(await isUsed(draft))) break;
    angle = pick(ANGLES);
  }
  return draft!;
}
