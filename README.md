# BalikGamit

Campus lost-and-found for RTU–Pasig. BSIT SIA project, Sep 13 – Dec 13, 2026.

Stack (per project plan): React 19 + TypeScript on Vite, React Router, zod, one Cloudflare Worker (Hono) for `/api/*`, Supabase (Auth, Postgres, Storage), Groq `openai/gpt-oss-120b` for match ranking. Tests use Vitest.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (needs .env.local)
npm test             # unit tests
npm run build        # typecheck (app + worker), then production build
```

The app needs the Supabase settings: copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key; ask the project lead). Without them the app shows a setup message. There is no demo mode: everything runs against the database, so sign in with a real `@rtu.edu.ph` account.

To run with the Worker: copy `.dev.vars.example` to `.dev.vars`, fill in both values, then run `npm run worker:dev` (port 8787). `vite` proxies `/api` to it.

## What is done and what is not

| Part | State |
|---|---|
| All routes, layouts, forms, validation, status flows | Done. |
| Item details (found and lost, student and admin) | Popups. Opened from a list, they sit over that page. Opened from a direct link, they sit over All found items or All lost items (students), or the office Found items / Lost reports lists. |
| Office pages: Found items, Edit found item, Lost reports, Unclaimed items, Reports (CSV export), Activity log, Categories & locations (super admin) | On the database. The activity log is written by triggers (`admin_activity`), so entries can't be faked. Holding period and other office numbers live in `office_settings`. |
| Students can report a lost-report post | On the database (`flags`). One flag per student per post, never on your own post; the office gets a notification. |
| Auth (sign in/up, RTU-only domain, verify, reset) | Supabase Auth. Sign-up records which Privacy Notice version the user agreed to (`src/lib/consent.ts`). Deactivated accounts can't sign in. |
| Data reads and writes (`src/data/api.ts`) | All on Supabase: reference lists and office settings (`reference.ts`), found items (`foundItems.ts`), lost reports, matches and flags (`lostReports.ts`), claims, messages and notifications with live updates (`claims.ts`), dashboard, reports, activity log and profile stats (`office.ts`), categories & locations, office accounts and settings (`admin.ts`). There is no sample data. |
| Match list (`GET /api/reports/:id/matches`) | Worker route is written. The app falls back to local word overlap if the Worker is not running. |
| Match job queue | `POST /api/reports/:id/match` inserts into `ai_jobs`. **Nothing processes that queue yet.** Add a consumer to the cron handler that calls `rankCandidates` (`worker/ai/groqClient.ts`), which is written and tested but not called anywhere yet. |
| Expiry (90-day reports, 5-day pickup) and reminders | The database functions exist (`run_expiry_sweep`, `run_pickup_expiry_sweep`, `run_reminders`). **The Worker cron still calls the old names** and must be updated. Until then nothing expires. |
| Photo upload | Found items: uploaded to the private `found-photos` bucket, re-encoded in the browser so location data is removed (`photos.ts`). Lost reports: same, into the private `lost-photos` bucket under the student's own folder. |
| Email notifications | Toggles only (not saved). No sender yet. |
| Office invites, account deletion | Call the Worker (`/api/admin/invite`, `/api/account`), which holds the service key. An existing account can be given an office role without the Worker. |

## Database

The schema lives in Supabase project `tifeckfqokdktspjokqm`. A copy is kept in `supabase/` (see `supabase/README.md`); change the database only through a new file in `supabase/migrations/`.

Tables (all with row-level security on):

| Table | What it holds | Who can read |
|---|---|---|
| `profiles` | name, email, `role` (`student`, `faculty`, `staff`, `admin`, `super_admin`), `is_active`, consent | yourself; admins |
| `categories`, `locations` | dropdown lists, with `archived` | everyone signed in; super admin edits |
| `office_settings` | one row: office name, pickup days, report expiry days, holding days | everyone, including signed-out pages |
| `found_items` | public listing, `ref` like `BG-1001`, status, hold and disposal fields | everyone signed in (hidden items: admins only) |
| `found_item_private` | `private_details`, `storage_location` (shelf) | admins only |
| `lost_reports` | public description, `ref` like `LR-1001`, status, `is_hidden`, `status_note` | active, visible reports: everyone signed in; the rest: owner and admins |
| `lost_report_private` | the owner's private details | owner and admins |
| `claims`, `claim_answers` | claims (`ref` like `CL-1001`) and proof answers | claimant and admins |
| `claim_threads`, `claim_messages` | claim-scoped chat, aliases `Owner` / `Office` | claimant and admins |
| `match_suggestions` | AI-ranked matches for a lost report | report owner and admins |
| `flags` | students reporting a post | the flagger and admins |
| `notifications` | in-app notifications | the recipient |
| `status_history` | every status change | admins; owners for their own records |
| `admin_activity` | the office activity log, written by triggers | admins |
| `ai_jobs`, `status_transitions` | AI queue, allowed status changes | server only |

Status changes and office actions go through database functions, which check the role and the allowed transitions:

- Students: `submit_claim`, `withdraw_claim`, `send_message`, `set_lost_report_status` (resolve, close, renew)
- Admins: `admin_decide_claim`, `complete_handover`, `admin_return_to_custody`, `admin_dispose_item`, `admin_set_hidden`, `admin_set_found_status`
- Super admin: `admin_set_role`, `admin_set_active`
- Worker only (service key): `run_expiry_sweep`, `run_pickup_expiry_sweep`, `run_reminders`, `purge_old_records`

Status values in `src/data/types.ts` match the database enums. Lost reports have no `hidden` status in the database; the app shows `is_hidden` as "hidden".

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
  auth/        AuthContext (Supabase Auth + reference lists)
  components/  Brand, Icon, ui primitives, MessageThread, Footer, Modal, ProfileMenu
  data/        types.ts, api.ts (what pages import) and one module per area (foundItems, lostReports, claims, office, admin, reference, photos)
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

Placeholders still to fill: the office name (`office_settings` in the database), and `[email]` / `[date]` in the Privacy Notice.
