-- Email switches on the Settings page. Each person's choices are stored on their own profile;
-- a missing key means the default (worker/email.ts decides which emails each switch controls).
-- Keys: matches, claims (students); newClaims, replies, flagged (office). In-app notifications are
-- always sent, whatever the switches say.

alter table public.profiles
  add column email_prefs jsonb not null default '{}'::jsonb
  constraint profiles_email_prefs_object check (jsonb_typeof(email_prefs) = 'object');

-- People can already update their own name ("profiles update own" policy); now their switches too.
-- Role and active status stay out of reach.
grant update (email_prefs) on public.profiles to authenticated;
