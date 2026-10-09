# BalikGamit

Campus lost-and-found web app for RTU–Pasig (BSIT SIA project). Project lead: Mark Vincent A. Bartolay.
Repo: github.com/Melloozzz/BalikGamit (the robszzs/BalikGamit repo is a different project — ignore it).

## Stack
- React 19 + TypeScript on Vite, React Router, zod. Tests: Vitest.
- One Cloudflare Worker (Hono) in `worker/` serves `/api/*` (match ranking via Groq `openai/gpt-oss-120b`).
- LLM use is limited to ranking possible matches for lost items and explaining a lost item's details. There is no AI search; don't add one.
- Supabase for auth, Postgres and storage — **not wired yet**.

## Run
```
npm install
npm run dev     # http://localhost:5173
npm test        # vitest, must stay green
npm run build   # typecheck (app + worker) then build — run before every commit
```
Demo mode runs when `VITE_SUPABASE_URL` is empty: in-memory sample data that resets on reload.
Sign in with any password of 8+ characters:
- `angela.reyes@rtu.edu.ph` — student
- `maria.santos@rtu.edu.ph` — super admin
- `jose.ramirez@rtu.edu.ph` — admin

A 502 on `/api/...` in demo mode is expected (no Worker running); pages fall back to local logic.

## How the code is organized
- `src/data/api.ts` is the only data layer. Pages never touch `mock.ts` directly. Each function is the swap point for a Supabase query later.
- `src/data/types.ts` holds the status enums; they must match the database enums.
- Item and lost-report details are **popups**, not pages: link with `ModalLink` from `components/Modal.tsx`. Direct visits render the popup over a list page (`detailFallback`).
- Admin pages live in `src/pages/admin/`, student pages in `src/pages/student/`, shared ones in `src/pages/shared/`.
- Styles: `src/styles/*.css`. Never use raw `vw`/`vh` — use `calc(N * var(--vw))` / `var(--vh)`; the fit-to-screen script in `index.html` zooms the page and raw viewport units break under zoom.

## Rules
- Design first: the owner reviews screens in Figma before they are coded. Figma file key `FRIlzUsk0jgvqwr18ipkXE`, page "Student Page".
- Privacy: private item details never reach student pages or the AI service (`toPublic()` in api.ts, whitelist in `worker/ai/groqClient.ts`). Keep both tests passing.
- Never commit `.dev.vars`, `.env.local`, `.streamlit/secrets.toml`, `node_modules`, `dist`.
- Do not write to the Lovable project database without the owner's explicit yes.
- Placeholders still to confirm with the office: `[Office name, Building]`, holding period (`OFFICE.holdingDays`, currently 60), `[holding period]` in Terms, `[email]`/`[date]` in the Privacy Notice.
