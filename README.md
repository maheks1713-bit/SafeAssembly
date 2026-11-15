# SafeAssembly

Agentic AI that keeps public gatherings safe, lawful and informed.

Six AI agents (Planner, Rights, Monitor, Dispatcher, Comms, Report) coordinate volunteer marshals at a peaceful gathering. A human approves every public message and every 911 call. **No faces. No names. No tracking.** Marshals report zone-level crowd levels only.

```
app/      Expo (React Native) app: organizer + marshal roles, hidden Scenario Injector
server/   Node + Express (TypeScript) agent server: one route per agent + /tick orchestrator
docs/     Data contracts
```

## Architecture

- **Phones never talk to Gemini.** The app holds only the Supabase URL, the Supabase *anon* key and the agent server URL.
- Marshal phones insert `reports` straight into Supabase, then call `POST /tick`.
- `/tick` runs **Monitor** (deterministic rules + Gemini one-line explanation) → **Dispatcher** (code picks the nearest free volunteer, Gemini writes the radio instruction) → **Comms** (fact-checks social posts against the event's `facts_json`). Every step writes an `agent_log` row.
- Supabase Realtime pushes every change to every phone.
- **Planner**, **Rights** and **Report** are on-demand routes. Approvals go through the server so each decision is logged.
- Every Gemini call is JSON-schema constrained, zod-validated, retried once, times out at 8 s, then falls back to `server/cache/` (demo-safety answers).

## Setup

### 1. Supabase
1. Create a free project at supabase.com.
2. SQL Editor → paste and run [`server/sql/schema.sql`](server/sql/schema.sql) (tables, Realtime, RLS).
3. Project Settings → API: copy the **URL**, the **anon** key (for the app) and the **service_role** key (server only).

### 2. Gemini key
Google AI Studio (aistudio.google.com) → **Get API key** → **Create API key**. Check the current model list and your rate limits there.

### 3. Server
```bash
cd server
npm install
cp .env.example .env       # fill in GEMINI_API_KEY, model names, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm run seed               # 1 event, 3 zones, 9 volunteers (also = "Reset demo")
npm run ping-gemini        # should print JSON in < 3 s
npm run test-contracts     # all agent prompts -> valid JSON; also warms cache/
npm test                   # Monitor + Dispatcher rule unit tests
npm run dev                # http://localhost:3000/health
```
No Gemini key yet? Leave it empty: the server runs **cache-only** on the golden-path answers in `cache/`.

### 4. App
```bash
cd app
npm install
cp .env.example .env       # Supabase URL + anon key, EXPO_PUBLIC_API_URL
npx expo start             # scan the QR code with Expo Go
```
Leave the Supabase values empty to run the whole app on built-in **mock data** (no backend). When the server runs on your laptop, use `http://<laptop-LAN-IP>:3000` as `EXPO_PUBLIC_API_URL`, not `localhost`.

### 5. Deploy the server to Render
New Web Service → root directory `server` → build `npm install` → start `npm start`. Add env vars: `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EVENT_ID`. Commit `server/cache/` after a good rehearsal so the fallback answers exist on Render too. The free tier sleeps: open `/health` 5 minutes before a demo.

## Running the demo
- Phone A: **I'm an organizer**. Phone B: **I'm a marshal or medic** (tap the callsign tile to pick M4).
- Long-press the logo on the role picker to open the **Scenario Injector** (Crowd 5, Medical, Cold snap, Transit, Fake cancel, Incitement, Accurate, paste any post, Reset demo).
- Golden path: Crowd 5 at Barrington Exit → map turns red, Monitor → Dispatcher in Agent Activity, M4's phone buzzes → Force cold snap → Fake cancel → Approve → Medical at Stage → 911 draft → End event → Report.
- **Call 911 never dials.** It logs "Organizer chose to call 911". In production it would open the dialer with 911 ready and the human presses call.

## Privacy and safety principles
- Reports carry a zone and a level only: no names, photos or GPS.
- Nothing is posted and no emergency call is made without a person tapping.
- Agents are nonpartisan and never comment on the cause of a gathering.
- Rights answers come only from the curated text in `server/src/prompts/rights_text.md` and always say "General information, not legal advice."
- Policy: logs are deleted 30 days after the event.

## Team
| Lane | Owner | Owns |
|---|---|---|
| A: Backend & AI | Nabiha | Supabase, agent server, prompts, Render |
| B: Mobile | Teammate 2 | Expo app, Realtime, notifications |
| C: Content & story | Teammate 3 | Rights text, permit template, Injector, demo + video |

Before making the repo public: search for `AIza` (Gemini keys) and confirm no `.env` file is committed.
