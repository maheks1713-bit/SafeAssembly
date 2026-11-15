# Data contracts

Tables: see [`server/sql/schema.sql`](../server/sql/schema.sql). App row types: [`app/src/lib/types.ts`](../app/src/lib/types.ts). Gemini output schemas: [`server/src/schemas.ts`](../server/src/schemas.ts). Mock data for every screen: [`app/src/lib/mocks.ts`](../app/src/lib/mocks.ts).

Three additions to the plan's schema: `assignments.kind` (`move` | `hold`), `drafts.meta` (verdict, harm, priority, shares) and `drafts.alert_id`.

## Routes

| Route | Body | Returns |
|---|---|---|
| `GET /health` | | `{ ok, last_tick, last_error, gemini: "live" \| "cache-only", event_id }` |
| `POST /tick` | | `{ alerts, posts }` (counts created this tick) |
| `POST /plan` | `{ place?, when?, size?, sound?, route?, activity?, name? }` | Plan (below); also stored in `events.facts_json.plan` |
| `POST /plan/submitted` | | Plan with `submitted: true` |
| `POST /rights` | `{ question, lang: "en" \| "fr" }` | Rights answer (below) |
| `POST /report` | | Report (below); sets `events.status = 'ended'` |
| `POST /drafts/:id/approve` | `{ body_en?, body_fr? }` (organizer edits) | Draft row |
| `POST /drafts/:id/reject` | | Draft row |
| `POST /alerts/:id/resolve` | | Alert row (status `handled`, its volunteers freed) |
| `POST /inject/:kind` | kind: `crowd5`, `medical`, `blocked-exit`, `cold-snap`, `transit`, `fake-cancel`, `fake-moved`, `incitement`, `accurate`, `accurate-sound` | `{ ok, tick }` |
| `POST /inject/paste` | `{ text }` | `{ ok, tick }` |
| `POST /reset` | | `{ ok, seeded }` |

## Sample responses

```jsonc
// POST /rights
{ "answer": "The Charter protects your right to gather peacefully. But that right has **reasonable limits**...",
  "cited_sections": ["Charter s. 2(c)", "Charter s. 1"], "confidence": "high", "covered": true,
  "disclaimer": "General information, not legal advice.", "ms": 1400, "source": "gemini" }

// POST /plan
{ "permit_fields": [{ "label": "Organizer", "value": "[YOUR GROUP NAME]" }],
  "permit_markdown": "## Public gathering application (draft)...",
  "checklist": [{ "item": "Confirm candle rules with HRM", "owner": "Organizer", "due": "3 days before", "done": false }],
  "route_notes": "...", "questions_for_city": ["Are open flames (candles) allowed on the square?"],
  "disclaimer": "Draft only. Verify with HRM ...", "generated_at": "...", "ms": 9000, "source": "gemini", "submitted": false }

// POST /report
{ "summary": "...", "stats": { "alerts": 3, "people_moved": 3, "corrections": 1, "calls_911": 1 },
  "timeline": [{ "time": "7:11 PM", "text": "Choke point at Barrington Exit. M2, M5 sent." }],
  "lessons": ["Open a second exit on George St when more than 600 people attend."],
  "event_name": "Halifax Climate Vigil", "ended_at": "...", "generated_at": "...", "privacy": "...", "source": "gemini" }
```

## agent_log.output_json keys the app reads
`why` (WHY box), `handoff` ("Handed to Dispatcher"), `draft_id` + `awaiting_approval` ("Waiting for your approval" / "Human approved"), `source` (`cache` shows "Served from demo-safety cache").
