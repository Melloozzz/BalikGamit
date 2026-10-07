# BalikGamit

Campus lost-and-found for RTU–Pasig. BSIT SIA project, Sep 13 – Dec 13, 2026.

Stack (per project plan): React 19 + TypeScript on Vite, React Router, zod, one Cloudflare Worker (Hono) for `/api/*`, Supabase (Auth, Postgres, Storage), Groq `openai/gpt-oss-120b` for match ranking. Tests use Vitest.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173, demo mode
npm test             # unit tests
npm run build        # typecheck (app + worker), then production build
```

**Demo mode** runs when `VITE_SUPABASE_URL` is empty. It uses in-memory sample data, which resets on reload. To sign in:

| Account | Role | Lands on |
|---|---|---|
| `angela.reyes@rtu.edu.ph` | student | `/home` |
| `maria.santos@rtu.edu.ph` | super admin | `/admin` |
| `jose.ramirez@rtu.edu.ph` | admin | `/admin` |

Any password of 8 or more characters works.

To run with the Worker: copy `.dev.vars.example` to `.dev.vars`, fill in both values, then run `npm run worker:dev` (port 8787). `vite` proxies `/api` to it.

## What is real and what is mocked

| Part | State |
|---|---|
| All routes, layouts, forms, validation, status flows | Done. |
| Item details (found and lost, student and admin) | Popups. Opened from a list, they sit over that page. Opened from a direct link, they sit over All found items or All lost items (students), or the office Found items / Lost reports lists. |
| Office pages: Found items, Edit found item, Lost reports, Unclaimed items, Reports (CSV export), Activity log, Categories & locations (super admin) | Done on demo data. The activity log needs a database trigger in production so entries can't be faked. Holding period is a placeholder (`OFFICE.holdingDays`). |
| Students can report a lost-report post | Done. Creates a flagged post and an office notification; one report per student per post. |
| Auth (sign in/up, RTU-only domain, verify, reset) | Wired to Supabase Auth when env vars are set; demo otherwise. |
| Data reads and writes (`src/data/api.ts`) | **In-memory mock.** Each function is the swap point for a Supabase query. The UI code does not change. |
| AI search (`POST /api/search`) and match list (`GET /api/reports/:id/matches`) | Worker routes are written. The app falls back to local word overlap if the Worker is not running. |
| Match job queue | `POST /api/reports/:id/match` inserts into `ai_jobs`. **Nothing processes that queue yet.** Add a consumer to the cron handler. |
| Expiry (90-day reports, 5-day pickup) | The cron calls `expire_old_reports` / `expire_unclaimed_pickups`. **These SQL functions still have to be written.** |
| Photo upload | UI only. It is not yet sent to Supabase Storage. |
| Email notifications | Toggles only. No sender yet. |

## Database the code expects

There are no migrations in this repo yet. These are the names the code uses:

- Tables:
  - `profiles` (id, full_name, email, role: `student|admin|super_admin`, active)
  - `categories`, `locations`
  - `found_items`, with `private_details` and `shelf_tag` readable by admins only (RLS)
  - `lost_reports`
  - `claims`
  - `messages`, with RLS limited to the claimant and admins
  - `matches`
  - `ai_jobs`
  - `notifications`
  - `flagged_posts`
- RPCs:
  - `search_found_candidates(q, max)`, which returns public fields only and at most 20 rows
  - `expire_old_reports()`
  - `expire_unclaimed_pickups()`
- Status enums match `src/data/types.ts` exactly.

## Privacy rules enforced in code

- Private details never reach the browser on student pages: `toPublic()` in `api.ts` strips them.
- Private details never reach Groq: `groqClient.ts` whitelists the public fields, and a test covers this.
- Messages, reports and claim answers block:
  - phone numbers
  - emails
  - social links and handles
  - student numbers and long ID numbers

  This is enforced in `lib/validation.ts` and tested.
- Message senders show only as "Office" or "Owner".
- The AI output is advisory. Model replies are filtered to candidate IDs that actually exist.

## Layout

```
src/
  auth/        AuthContext (Supabase or demo)
  components/  Brand, Icon, ui primitives, MessageThread, Footer, Modal, ProfileMenu
  data/        types.ts, mock.ts, api.ts (swap point)
  layouts/     Auth, Marketing, Student, Admin, Drawer
  lib/         validation (zod), format (Asia/Manila), supabase, useLoad
  pages/       public/ auth/ student/ admin/ shared/ (inbox, profile) details/ (item popups)
  styles/      tokens, base, auth, site, app, admin
worker/
  index.ts     Hono /api, auth check, cron
  ai/          groqClient.ts
```

## Where the code differs from the Figma file

These were deliberate fixes for errors in the mockups:

- The report form's location and date dropdowns were labelled "All categories". They now have proper labels.
- Log Found Item:
  - The duplicate "Log Found Item" button inside the form is removed.
  - "Date Found" showed "ID's & Cards"; it is now a date field.
- The Flagged Posts eyebrow said "CONTENT GENERATION". It now says "CONTENT MODERATION".
- The Claim Queue showed student numbers, which goes against our own no-ID-numbers rule. It now shows the RTU email.
- The login label said "Username". It now says "Institutional Email".
- The report and log forms had no item-name field, but cards display a title. Added "Item name".
- Dashboard "Pending Claims" counted differently from the queue's "Needs action" tab. Both now use one rule (pending, needs info, approved and awaiting release), and the card is labelled "Claims needing action".
- On phones, admin tables become stacked rows instead of scrolling sideways.

Placeholders still to fill: `[Office name, Building]` in `src/data/mock.ts`, and `[email]` / `[date]` in the Privacy Notice.
