# BalikGamit

Campus lost-and-found web app for RTU–Pasig (BSIT SIA project). Project lead: Mark Vincent A. Bartolay.
Repo: github.com/Melloozzz/BalikGamit (the robszzs/BalikGamit repo is a different project — ignore it).

## Stack
- React 19 + TypeScript on Vite, React Router, zod. Tests: Vitest.
- One Cloudflare Worker (Hono) in `worker/` serves `/api/*` (match ranking via Groq `openai/gpt-oss-120b`).
- LLM use is limited to ranking possible matches for lost items and explaining a lost item's details. There is no AI search; don't add one.
- Supabase for auth, Postgres and storage. Schema in `supabase/migrations/`, reference data in `supabase/seed.sql`.

## Run
```
npm install
npm run dev     # http://localhost:5173 (needs .env.local)
npm test        # vitest, must stay green
npm run build   # typecheck (app + worker) then build — run before every commit
```
Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key; ask the project lead). Without them the app shows a setup message. There is no demo mode or sample data: sign in with a real `@rtu.edu.ph` account.

## Deploy
Cloudflare builds and deploys the Worker from `main` (GitHub connected). The domain is balikgamit.site. While `COMING_SOON` is `"true"` in `wrangler.jsonc`, the domain shows `public/coming-soon/` (gate in `worker/comingSoon.ts`). The team tests on dev.balikgamit.site, which Cloudflare Access (Zero Trust) limits to their emails; there is no workers.dev address. Set it to `"false"` to launch.

## How the code is organized
- Pages import data functions only from `src/data/api.ts`, which re-exports the Supabase modules (`foundItems.ts`, `lostReports.ts`, `claims.ts`, `office.ts`, `admin.ts`, `reference.ts`). Status changes go through database functions (`supabase.rpc`).
- `src/data/types.ts` holds the status enums; they must match the database enums.
- Item and lost-report details are **popups**, not pages: link with `ModalLink` from `components/Modal.tsx`. Direct visits render the popup over a list page (`detailFallback`).
- Admin pages live in `src/pages/admin/`, student pages in `src/pages/student/`, shared ones in `src/pages/shared/`.
- Styles: `src/styles/*.css`. Never use raw `vw`/`vh` — use `calc(N * var(--vw))` / `var(--vh)`; the fit-to-screen script in `index.html` zooms the page and raw viewport units break under zoom.

## Rules
- Design first: the owner reviews screens in Figma before they are coded. Figma file key `FRIlzUsk0jgvqwr18ipkXE`, page "Student Page".
- Privacy: private item details never reach student pages or the AI service. They live in separate `*_private` tables that student queries never select (`PUBLIC_COLS` in the data modules), and the AI request uses the whitelist in `worker/ai/groqClient.ts`. Keep `foundItems.test.ts` and `groqClient.test.ts` passing.
- Never commit `.dev.vars`, `.env.local`, `.streamlit/secrets.toml`, `node_modules`, `dist`.
- Do not write to the Lovable project database without the owner's explicit yes.
- Placeholders still to confirm with the office: `[Office name, Building]` (`office_settings` in the database), holding period (`office_settings.holding_days`, currently 60), `[holding period]` in Terms, `[date]` in the Privacy Notice and Terms.
 
