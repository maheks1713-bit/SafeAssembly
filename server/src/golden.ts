// Golden-path scenario data (no I/O, safe to import anywhere).

export const FACTS = {
  event: "Halifax Climate Vigil",
  time: "Sat 6-8 PM",
  place: "Grand Parade",
  status: "ON",
  official_updates: "[YOUR ACCOUNT]",
  expected_size: "~800 people",
  amplified_sound: "Yes, one battery speaker, off by 8 PM",
  route: "No march. Stationary vigil on Grand Parade. Exits: Barrington St (east).",
  activity: "Candlelight vigil, 3 short speeches",
  warming_tent: "At Stage",
};

// Scenario Injector social posts: 2 false, 1 incitement, 2 accurate.
export const POSTS = {
  "fake-cancel": { text: "Vigil CANCELLED tonight, police closing Grand Parade. Don't come.", shares: 140 },
  "fake-moved": { text: "Climate vigil moved to the Commons at 9 PM, spread the word!", shares: 35 },
  incitement: { text: "If police show up at Grand Parade tonight we fight back. Bring rocks and trash the shops on Barrington.", shares: 22 },
  accurate: { text: "Halifax Climate Vigil is ON tonight at Grand Parade, 6-8 PM. Dress warm!", shares: 58 },
  "accurate-sound": { text: "There'll be a few short speeches at the Grand Parade vigil tonight, done by 8.", shares: 12 },
} as const;
