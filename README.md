# OPERATION: BIRTHDAY

An interactive, JARVIS-style mission briefing for a birthday on **Tuesday, 8 December 2026, 14:20 in Lucerne**. Guests identify with their first name, scroll through one continuous briefing (meeting point, escape room, sushi finale, dossier, countdown) and can ask questions to JARVIS, an AI assistant powered by Groq. The host manages everything in a password-protected admin dashboard.

```
frontend/   Vite + React + TypeScript, GSAP ScrollTrigger, Three.js  → GitHub Pages
backend/    Cloudflare Worker (REST API) + D1 database              → Cloudflare
shared/     Types and Europe/Zurich time helpers used by both sides
scripts/    Password-hash and encryption-key generators
```

## How it works

| Piece | Details |
| --- | --- |
| Guest identification | First name is matched server-side against the guest list (case- and umlaut-insensitive: `Jürg` = `juerg`). Unknown names are rejected; no records are created. A random device token is returned and only its SHA-256 hash is stored. |
| Progress tracking | The browser reports the furthest section reached. Progress only moves forward. The briefing is marked **completed** only after the dossier section has actually been on screen, and the server refuses completion if the guest never reached the sushi section. |
| JARVIS chat | `POST /api/chat` → Worker → Groq. The key never leaves the Worker. Event data is injected as structured JSON with binding rules (no invented facts, say when something is unknown, no secrets). Message contents are **not** stored, only a per-guest counter. Rate limits: 20 messages / 10 min and 150 / day per guest, 40 / 10 min per IP. |
| Groq key storage | Sent once over HTTPS from the admin dashboard, encrypted with AES-256-GCM (key in the `ENCRYPTION_KEY` Worker Secret) and stored in D1. It is never returned to any browser. |
| Admin auth | One password, stored only as a PBKDF2-SHA256 hash in the `ADMIN_PASSWORD_HASH` Worker Secret. Login creates a 12-hour session in an `HttpOnly; Secure` cookie. Every `/api/admin/*` endpoint checks it. State-changing requests must come from an allowed origin and carry a custom header (CSRF protection). Login is limited to 5 attempts per 15 min. |
| Timezone | All times are wall-clock times in `Europe/Zurich`, converted with `Intl` (DST-safe; covered by tests). Countdown, calendar links and the `.ics` file all use the same conversion. |
| Calendar | Apple (`.ics` with VTIMEZONE + 2 h reminder), Google and Outlook links. **No end time is ever invented**: until you set one, the entry is labelled "Treffpunkt 14:20" and says the end time is still open. |
| Map | Official swisstopo national map (grey edition, open government data, no API key), styled to the site's palette. The meeting point is the official stop *Luzern, Kantonalbank* (stop id 8589801, 47.048867 / 8.306236), directly in front of the Luzerner Kantonalbank at Pilatusstrasse 12. |
| 3D | Safe, sushi and the JARVIS orb are procedural Three.js scenes (no downloaded models). They load only when needed, pause off-screen and fall back to a notice when WebGL is not available. |
| No backend configured | If the frontend is built without `VITE_API_URL`, it shows a "System nicht konfiguriert" screen instead of pretending to work. If no Groq key is stored, JARVIS says so instead of answering. |

## Prerequisites

- Node.js 20+ and npm
- A Cloudflare account (the free plan is enough)
- A GitHub repository for this project
- A Groq API key from <https://console.groq.com/keys> (you enter it later in the dashboard)

## 1. Install dependencies

```bash
cd backend && npm install
```

```bash
cd frontend && npm install
```

## 2. Configure Cloudflare

Log in once (opens a browser):

```bash
cd backend && npx wrangler login
```

## 3. Create the D1 database

```bash
cd backend && npx wrangler d1 create operation-birthday
```

Copy the printed `database_id` into `backend/wrangler.toml` (replace the `0000…` placeholder).

## 4. Run the database migrations

```bash
cd backend && npm run db:migrate:remote
```

This creates the tables `guests`, `briefing_sessions`, `chat_usage`, `event_settings`, `encrypted_secrets`, `admin_sessions` and `rate_limits` (see `backend/migrations/0001_init.sql`).

## 5. Configure secrets

Generate an encryption key and store it as a Worker Secret (paste the output when asked):

```bash
cd backend && npm run gen-key
```

```bash
cd backend && npx wrangler secret put ENCRYPTION_KEY
```

Keep this key stable. If you change it later, the stored Groq key can no longer be decrypted and you need to enter it again.

The admin password is covered in step 9.

## 6. Deploy the Worker

Set the origin of your GitHub Pages site in `backend/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://<your-github-user>.github.io"
COOKIE_SAMESITE = "None"
```

`ALLOWED_ORIGINS` is the origin only: no path, no trailing slash. Separate several origins with commas.

```bash
cd backend && npm run deploy
```

Wrangler prints the Worker URL, e.g. `https://operation-birthday-api.<subdomain>.workers.dev`. Check it:

```bash
curl https://operation-birthday-api.<subdomain>.workers.dev/api/health
```

## 7. Configure the frontend API URL

The frontend needs the Worker URL at build time.

- **GitHub Actions (recommended):** in the repository go to *Settings → Secrets and variables → Actions → Variables* and add
  - `VITE_API_URL` = `https://operation-birthday-api.<subdomain>.workers.dev`
  - `VITE_BASE` (optional) = `/<repository-name>/` for a project page (the default), or `/` for a user page or custom domain.
- **Local build:** copy `frontend/.env.example` to `frontend/.env.production.local` and fill in the same values.

The build also writes a Content-Security-Policy that only allows connections to this API origin.

## 8. Deploy to GitHub Pages

1. Push the repository to GitHub.
2. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
3. Pushing to `main` runs `.github/workflows/deploy-pages.yml` (tests, build, deploy). You can also start it manually under *Actions*.

The guest site is at `https://<user>.github.io/<repo>/`, the dashboard at `https://<user>.github.io/<repo>/admin/`.

GitHub Pages only serves static files. All logic runs in the Worker.

## 9. Configure the admin password

Create the hash locally (you are prompted for the password, minimum 12 characters):

```bash
cd backend && npm run hash-password
```

Store the printed `pbkdf2-sha256$…` value as a secret:

```bash
cd backend && npx wrangler secret put ADMIN_PASSWORD_HASH
```

To change the password later, repeat both commands. Existing sessions end after at most 12 hours. Use *Abmelden* to end yours immediately.

## 10. Configure Groq in the dashboard

1. Open `/admin/` and log in.
2. **Gäste**: add the four first names. Each name can exist only once.
3. **Event**: check the details and fill in what is still open: escape room name, address and time, restaurant address, optional end time, extra instructions. Empty fields are shown to guests as "wird noch übermittelt", never guessed.
4. **JARVIS / Groq**: paste the API key, click *Speichern*, then *Verbindung testen*. The test lists the models available to your key and sends a short test prompt to the selected model.
5. Adjust the model if needed (default `llama-3.3-70b-versatile`) and, optionally, the personality prompt. The rules and event data are appended automatically and cannot be removed by editing the prompt.

## Cookies across domains

GitHub Pages (`github.io`) and Workers (`workers.dev`) are different sites, so the admin cookie is sent as a third-party cookie (`SameSite=None; Secure; Partitioned`). This works in current Chrome, Edge and Firefox. **Safari may block it.** If admin login does not stick in your browser, use one of these:

- **Recommended:** put both on one domain you own, e.g. `party.example.ch` (custom domain for GitHub Pages) and `api.party.example.ch` (Worker *Custom Domain* in the Cloudflare dashboard). Then set `COOKIE_SAMESITE = "Strict"` and update `ALLOWED_ORIGINS` / `VITE_API_URL`.
- Use Chrome or Firefox for the dashboard. The guest site does not use cookies (it uses a bearer token), so guests are not affected.

## Local development

```bash
cd backend && cp .dev.vars.example .dev.vars
```

Fill `.dev.vars` with `npm run gen-key` and `npm run hash-password` output, then:

```bash
cd backend && npm run db:migrate:local
```

```bash
cd backend && npm run db:seed:dev
```

```bash
cd backend && npm run dev
```

```bash
cd frontend && npm run dev
```

The guest site runs at <http://localhost:5173>, the dashboard at <http://localhost:5173/admin/>. The dev seed creates two obviously fake guests (`Testagent`, `Demo`) in the **local** database only. Never run it against `--remote`.

### Tests

```bash
cd backend && npm test
```

```bash
cd frontend && npm test
```

The tests cover the Zurich/DST conversions, countdown, `.ics` generation (escaping, line folding, timezone), Google/Outlook links, AES-GCM secret encryption, password verification, name normalisation, chat input sanitising and event-settings validation.

## API overview

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | none |
| POST | `/api/identify` | none (rate-limited) |
| GET | `/api/briefing` | guest token |
| POST | `/api/briefing/progress` | guest token |
| POST | `/api/briefing/complete` | guest token |
| POST | `/api/chat` | guest token (rate-limited) |
| POST | `/api/admin/login`, `/api/admin/logout` | none / cookie |
| GET | `/api/admin/session`, `/api/admin/stats` | admin cookie |
| GET/POST | `/api/admin/guests` | admin cookie |
| PATCH/DELETE | `/api/admin/guests/:id` | admin cookie |
| POST | `/api/admin/guests/:id/reset` | admin cookie |
| GET/PUT | `/api/admin/event` | admin cookie |
| GET/PUT | `/api/admin/ai` | admin cookie |
| PUT/DELETE | `/api/admin/ai/key` | admin cookie |
| POST | `/api/admin/ai/test` | admin cookie |

## Optional: deploy the Worker from GitHub Actions

`.github/workflows/deploy-worker.yml` (manual trigger) runs the tests, applies migrations and deploys. Add the repository secrets `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers" plus D1 edit permission) and `CLOUDFLARE_ACCOUNT_ID`. Worker Secrets (`ENCRYPTION_KEY`, `ADMIN_PASSWORD_HASH`) stay in Cloudflare and are not needed in GitHub.

## For the host: hidden features

- **Chat commands** (handled by the page and shown as SYSTEM messages, not AI answers): `/status` (live diagnostics), `/hilfe`, `/neu` (clear history), and the unlisted `/selbstzerstörung` and `/mark2`.
- **Konami code** (↑ ↑ ↓ ↓ ← → ← → B A) toggles the "Mark II" blueprint palette.
- **Mission ID** in the HUD: click it five times quickly.
- **Sushi:** tap the same piece five times.
- **Safe:** tap the dial to turn it.
- Interface sounds are off by default. The speaker button in the HUD turns them on (synthesised, no audio files).

## Before the event

- The restaurant is configured as **"Nigishi Sushi"** exactly as specified. Lucerne listings show a restaurant called **Negishi Sushi Bar**, with one location at Pilatusstrasse 1. If that's the place, correct the name and add the address in the dashboard. The map link then points to the exact location.
- Escape room name, address and time are empty until you fill them in.
- If the Groq model is ever retired, run *Verbindung testen* and pick another model from the list.
