import AsyncStorage from "@react-native-async-storage/async-storage";
import { ANGLES, DEFAULT_CAUSE, TONES, composeEmail, isUsed, markUsed, pick } from "../cause";

const ev = { name: "Halifax Climate Vigil", place: "Grand Parade", time: "Sat 6-8 PM" };
const mayor = DEFAULT_CAUSE.contacts.find((c) => c.id === "mayor")!;

describe("default cause content", () => {
  it("every contact can be reached: an email, a phone, or a lookup page", () => {
    for (const c of DEFAULT_CAUSE.contacts) expect(Boolean(c.email || c.phone || c.lookup_url)).toBe(true);
  });
  it("lists only public office channels (no personal email domains)", () => {
    for (const c of DEFAULT_CAUSE.contacts) if (c.email) expect(c.email).toMatch(/@(halifax\.ca|novascotia\.ca)$/);
  });
  it("lookup links are https", () => {
    for (const c of DEFAULT_CAUSE.contacts) if (c.lookup_url) expect(c.lookup_url).toMatch(/^https:\/\//);
  });
});

describe("pick", () => {
  it("returns an item from the list", () => {
    for (let i = 0; i < 20; i++) expect(TONES).toContain(pick(TONES));
  });
});

describe("composeEmail (no-AI writer on the phone)", () => {
  it("addresses the office, states the ask, and leaves name placeholders for the sender", async () => {
    const d = await composeEmail(DEFAULT_CAUSE, mayor, ev, ANGLES[1]);
    expect(d.source).toBe("phone");
    expect(d.body.startsWith("Dear Mayor,")).toBe(true);
    expect(d.body).toContain(DEFAULT_CAUSE.ask);
    expect(d.body).toContain("[Your name]");
    expect(d.body).toContain("[Your neighbourhood or postal code]");
    expect(d.subject.length).toBeGreaterThan(0);
  });

  it("uses the chosen angle", async () => {
    const d = await composeEmail(DEFAULT_CAUSE, mayor, ev, ANGLES[1]); // health
    expect(d.body).toContain("Wildfire smoke and extreme heat");
  });

  it("never repeats an email this phone has already produced", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const d = await composeEmail(DEFAULT_CAUSE, mayor, ev);
      expect(seen.has(d.body)).toBe(false);
      seen.add(d.body);
      await markUsed(d);
    }
  });
});

describe("isUsed / markUsed", () => {
  it("matches drafts that differ only in placeholders, case or punctuation", async () => {
    await markUsed({ body: "Dear Mayor, Please act! [Your name]" });
    expect(await isUsed({ body: "dear mayor please act [Jane Doe]" })).toBe(true);
    expect(await isUsed({ body: "Dear Premier, please act" })).toBe(false);
  });

  it("persists fingerprints to AsyncStorage", async () => {
    await markUsed({ body: "Persist me" });
    await new Promise((r) => setTimeout(r, 0));
    const stored = JSON.parse((await AsyncStorage.getItem("safeassembly.emails")) ?? "[]");
    expect(stored.length).toBeGreaterThan(0);
  });
});
