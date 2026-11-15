# SafeAssembly: team setup guide

This gets SafeAssembly running on your laptop and phone. It takes about 20 minutes.

- **Everyone** does Parts 1–4.
- Only the **tech lead** (or whoever runs the backup server) does Part 5.

If you get stuck for more than 30 minutes, post in the team chat with the exact error message.

---

## Part 1: Install the tools (once)

| Tool | Where | Check it worked |
|---|---|---|
| **Node.js 22 or 24 (LTS)** | nodejs.org → download the LTS installer | `node -v` prints v22 or v24 |
| **Git** | git-scm.com (Mac: run `xcode-select --install`) | `git --version` |
| **VS Code** (recommended) | code.visualstudio.com | |
| **Expo Go** on your phone | App Store / Google Play | Open it once |

**Expo Go must be the latest version.** The app uses Expo SDK 58, and older Expo Go versions show an "incompatible SDK version" error. If you already have Expo Go, update it.

---

## Part 2: Get the code

```bash
git clone https://github.com/maheks1713-bit/SafeAssembly
cd SafeAssembly
```

The repo has three folders:

```
app/      the mobile app (Expo / React Native)
server/   the agent server (Node + Express); only the tech lead needs to run it
docs/     this guide and the data contracts (contracts.md)
```

---

## Part 3: Set up the app

### 3.1 Install packages

```bash
cd app
npm install
```

### 3.2 Create your `app/.env` file

Copy the example file:

- **Mac/Linux:** `cp .env.example .env`
- **Windows (PowerShell):** `copy .env.example .env`

Open `app/.env` and fill in the values. **Ask the tech lead for them in a private message.**

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the "anon" / publishable key>
EXPO_PUBLIC_API_URL=<the server address, see below>
EXPO_PUBLIC_EVENT_ID=00000000-0000-4000-8000-000000000001
EXPO_PUBLIC_USE_MOCKS=false
```

For `EXPO_PUBLIC_API_URL`, use one of these:

- **The Render server (normal case):** `https://<our-app>.onrender.com`
- **The tech lead's laptop (backup):** `http://<their-laptop-IP>:3000`. You must be on the **same Wi-Fi** as that laptop. Use the IP address, not `localhost`.

> **Want to work on screens without the backend?** Leave the two `SUPABASE` lines empty. The app then runs on built-in demo data, and every screen is tappable. Most UI work is easiest this way.

### 3.3 Never put these in `app/.env`

- **Not the Gemini key** (it starts with `AIza` or `AQ.`).
- **Not the Supabase `service_role` / secret key.**

Anything named `EXPO_PUBLIC_*` is bundled into the app, and anyone can read it. The app only ever needs the URL, the **anon** key and the server address.

---

## Part 4: Run it on your phone

```bash
cd app
npx expo start
```

1. Put your phone on the **same Wi-Fi** as your laptop.
2. Scan the QR code. On iPhone, use the Camera app; on Android, use the scanner inside Expo Go.
3. Windows only: if a firewall pop-up asks about Node.js, click **Allow** for private networks.

**Check it worked:** you see the teal **SafeAssembly** role-picker screen.

- If it says **"Demo data mode"** at the bottom, the app is on demo data. That means your `.env` Supabase values are empty or weren't loaded.
- **After any change to `.env`, restart with:** `npx expo start -c` (the `-c` clears the old settings).

**If the phone can't connect** (for example on school or venue Wi-Fi), stop the server with Ctrl+C and run `npx expo start --tunnel`.

### Quick tour

| Where | What |
|---|---|
| **I'm an organizer** | Command (map + alerts), Agents (live AI activity), Approvals, Plan, Rights |
| **I'm a marshal or medic** | Crowd level 1–5, Medical, Exit blocked. Tap the callsign tile (top left) to choose who you are, e.g. **M4**. |
| **Long-press the logo** on the role picker | **Scenario Injector**, the demo operator screen |
| **Pull down** on any screen | Refresh the data |

**Check it's all connected:** open the Injector. It should say **"Server online"**. Then press **Crowd 5 at Barrington Exit**. Within a few seconds the organizer map turns red and the M4 phone buzzes.

---

## Shared-demo rules (please read)

We all use **one shared database and one shared AI quota**. So:

1. **"Reset demo" wipes the data for everyone.** Say so in the chat before you press it, especially if someone else is mid-test.
2. **Don't spam the Injector buttons.** The Gemini free tier allows only about **20 requests per model per day**, shared by the whole team. One full golden-path run uses about 7–10.
   - When the quota runs out, the app still works using saved answers, but it gets slow (alerts take 15–25 s to appear).
   - For pure UI work, use **demo data mode** (Part 3.2) instead.
3. **Never paste keys in the team chat** or commit them. If a key leaks, tell the tech lead so it can be replaced.
4. **Git:** never push to `main` directly. Work like this:
   ```bash
   git checkout main
   git pull
   git checkout -b your-name/what-you-are-doing
   # ...make your changes...
   git add .
   git commit -m "Short description"
   git push -u origin your-name/what-you-are-doing
   ```
   Then open a pull request on GitHub.
5. **Before committing, run `git status`** and make sure no `.env` file is listed. (`.env.example` is fine; it holds no secrets.)

---

## Where to work, by lane

| Lane | Files you'll touch most |
|---|---|
| **B: Mobile** | `app/src/app/` (each file is a screen), `app/src/components/`, `app/src/lib/theme.ts` (colours, fonts) |
| **C: Content & story** | `server/src/prompts/rights_text.md` (check every line, tick `Checked: [ ]`), `server/src/prompts/permit_template.md`, `server/src/golden.ts` (demo social posts), `app/src/app/injector.tsx` |
| **A: Backend & AI** | `server/src/agents/`, `server/src/rules.ts`, `server/src/prompts/*.txt` |

Before you open a pull request for the app, run these from `app/`:

```bash
npx tsc --noEmit
npx expo lint
```

Both should finish with no errors.

---

## Part 5: Run the server (tech lead / backup only)

You need the secret values from the tech lead: the Gemini key, the Supabase `service_role` key, and the model names.

```bash
cd server
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Fill in `server/.env`:

```
GEMINI_API_KEY=<secret>
GEMINI_MODEL_FAST=gemini-3.5-flash-lite
GEMINI_MODEL_SMART=gemini-3.7-flash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>
EVENT_ID=00000000-0000-4000-8000-000000000001
```

Useful commands:

```bash
npm run dev            # start the server on port 3000 (leave it running)
npm test               # rule unit tests (free: no AI calls)
npm run ping-gemini    # 1 AI call: checks the key and model work
npm run seed           # resets the SHARED database (tell the team first!)
```

**`npm run test-contracts` uses about 21 AI requests.** On the free tier that is a model's whole daily quota, so only run it when billing is on.

To let teammates' phones use your laptop as the server:

1. Find your Wi-Fi IP address: `ipconfig` on Windows, or System Settings → Wi-Fi → Details on Mac.
2. Share `http://<that-IP>:3000` in the chat.
3. Everyone must be on the same Wi-Fi.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Incompatible SDK version" in Expo Go | Update Expo Go from the app store. |
| The app says "Demo data mode" | Your `app/.env` Supabase values are missing. Fix them, then run `npx expo start -c`. |
| The phone can't open the QR link | Make sure it's on the same Wi-Fi as the laptop, allow Node through the firewall, or use `npx expo start --tunnel`. |
| Injector says "Server offline" | Check `EXPO_PUBLIC_API_URL`. Render's free tier sleeps: open `<url>/health` in a browser and wait about 30 s. With a laptop server, check the IP and Wi-Fi. |
| A tap doesn't change the other phone | Pull down to refresh. If it still doesn't change, check the server terminal for errors and tell the tech lead. |
| Alerts take 15–25 s to appear | The Gemini quota is probably used up for the day. The app is using saved answers, which is expected. |
| The marshal phone doesn't buzz | Allow notifications for Expo Go, and turn off Do Not Disturb (or allow Expo Go through it). |
| `npm install` errors | Check `node -v` is 22 or newer. Delete the `node_modules` folder and run `npm install` again. |
