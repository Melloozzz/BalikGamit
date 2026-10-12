# Database files

The live database is the Supabase project `tifeckfqokdktspjokqm`. These files are its copy in the repo.

| File | What it is |
|---|---|
| `migrations/20261010000000_baseline.sql` | The whole database as of Oct 10, 2026: tables, status types, functions, triggers, row-level security policies, permissions, storage buckets and photo policies, and the sign-up trigger. Generated from the live project. |
| `seed.sql` | Starting data: office settings, categories, locations, proof questions, allowed status changes. No personal data. |
| `history/` | The two scripts that were run on Oct 10 to get the database to the baseline. A record only; don't run them again. |

## Rules

1. **The live project already matches the baseline.** Don't run it there.
2. **New project** (a teammate's copy, a fresh practice database): in the SQL Editor, run the baseline, then `seed.sql`. Then make your own account super admin:
   ```sql
   update public.profiles set role = 'super_admin' where email = 'your.name@rtu.edu.ph';
   ```
   If the photo policies at the end of the baseline fail with "must be owner of table objects", create them in the dashboard instead (Storage → Policies), using the definitions in the baseline file.
3. **Changing the database:** add a new file in `migrations/` with a later timestamp, for example `20261015090000_add_reminder_settings.sql`. Run it on the live project, then commit it. Never edit the baseline, and never change the database only in the dashboard: if it isn't in a migration file, the repo no longer matches the database.

## Settings that live outside SQL

These are set in the Supabase dashboard, not by the files above:

- Authentication → Sign In / Providers → Email: minimum password length 8; password requirements: lowercase, uppercase, digits and symbols. The app's sign-up form checks the same rule (`src/lib/validation.ts`).
- Leaked password protection: Pro plan only, so it is off.
