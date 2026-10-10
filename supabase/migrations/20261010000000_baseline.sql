-- BalikGamit database: full schema, generated from the live Supabase project
-- (tifeckfqokdktspjokqm) on 2026-10-10. Run this on a NEW, empty Supabase project, then seed.sql.
-- Do not run it on the existing project: it already has all of this.
-- Future changes: add a new file in supabase/migrations/ with a later timestamp. Never edit this one.

-- Extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create schema if not exists private;

-- Status types
create type public.claim_status as enum ('pending', 'needs_info', 'approved', 'rejected', 'withdrawn', 'completed', 'expired');
create type public.found_status as enum ('in_custody', 'claim_pending', 'ready_for_pickup', 'returned', 'donated', 'disposed');
create type public.job_status as enum ('queued', 'processing', 'done', 'failed');
create type public.lost_status as enum ('active', 'resolved', 'closed', 'expired');
create type public.match_likelihood as enum ('high', 'medium', 'low');
create type public.user_role as enum ('student', 'faculty', 'staff', 'admin', 'super_admin');

-- Reference-number sequences (BG-, LR-, CL-)
create sequence if not exists public.claims_ref_seq start 1001;
create sequence if not exists public.found_items_ref_seq start 1001;
create sequence if not exists public.lost_reports_ref_seq start 1001;

-- Tables
create table public.admin_activity (
  id bigint generated always as identity,
  actor_id uuid,
  kind text not null,
  text text not null,
  subject text,
  href text,
  created_at timestamp with time zone default now() not null,
  constraint admin_activity_pkey PRIMARY KEY (id),
  constraint admin_activity_kind_check CHECK ((kind = ANY (ARRAY['logged'::text, 'edited'::text, 'approved'::text, 'rejected'::text, 'asked'::text, 'released'::text, 'returned_to_custody'::text, 'hid'::text, 'unhid'::text, 'donated'::text, 'disposed'::text, 'extended'::text, 'places'::text, 'admins'::text])))
);

create table public.ai_jobs (
  id bigint generated always as identity,
  job_type text not null,
  target_type text not null,
  target_id uuid not null,
  status job_status default 'queued'::job_status not null,
  attempts integer default 0 not null,
  last_error text,
  run_after timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint ai_jobs_pkey PRIMARY KEY (id),
  constraint ai_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['extract_attributes'::text, 'rank_matches'::text]))),
  constraint ai_jobs_target_type_check CHECK ((target_type = ANY (ARRAY['lost_report'::text, 'found_item'::text])))
);

create table public.categories (
  id smallint generated always as identity,
  name text not null,
  sort_order smallint default 0 not null,
  archived boolean default false not null,
  constraint categories_name_key UNIQUE (name),
  constraint categories_pkey PRIMARY KEY (id)
);

create table public.claim_answers (
  id bigint generated always as identity,
  claim_id uuid not null,
  question_text text not null,
  answer_text text not null,
  constraint claim_answers_pkey PRIMARY KEY (id),
  constraint claim_answers_answer_text_check CHECK (((char_length(answer_text) >= 1) AND (char_length(answer_text) <= 1000)))
);

create table public.claim_messages (
  id bigint generated always as identity,
  thread_id uuid not null,
  sender_id uuid not null,
  sender_alias text not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  read_at timestamp with time zone,
  constraint claim_messages_pkey PRIMARY KEY (id),
  constraint claim_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000))),
  constraint claim_messages_sender_alias_check CHECK ((sender_alias = ANY (ARRAY['Owner'::text, 'Office'::text])))
);

create table public.claim_threads (
  id uuid default gen_random_uuid() not null,
  claim_id uuid not null,
  is_closed boolean default false not null,
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint claim_threads_claim_id_key UNIQUE (claim_id),
  constraint claim_threads_pkey PRIMARY KEY (id)
);

create table public.claims (
  id uuid default gen_random_uuid() not null,
  found_item_id uuid not null,
  lost_report_id uuid,
  claimant_id uuid not null,
  status claim_status default 'pending'::claim_status not null,
  decision_reason text,
  decided_by uuid,
  decided_at timestamp with time zone,
  pickup_office text,
  pickup_at timestamp with time zone,
  released_by uuid,
  released_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  pickup_deadline timestamp with time zone,
  ref text default ('CL-'::text || nextval('claims_ref_seq'::regclass)) not null,
  pickup_reminded_at timestamp with time zone,
  constraint claims_pkey PRIMARY KEY (id)
);

create table public.flags (
  id bigint generated always as identity,
  flagged_by uuid default auth.uid() not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text default 'open'::text not null,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  note text,
  constraint flags_pkey PRIMARY KEY (id),
  constraint flags_note_check CHECK ((char_length(note) <= 500)),
  constraint flags_reason_check CHECK (((char_length(reason) >= 3) AND (char_length(reason) <= 500))),
  constraint flags_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text]))),
  constraint flags_target_type_check CHECK ((target_type = ANY (ARRAY['lost_report'::text, 'found_item'::text])))
);

create table public.found_item_private (
  found_item_id uuid not null,
  private_details text default ''::text not null,
  updated_at timestamp with time zone default now() not null,
  storage_location text,
  constraint found_item_private_pkey PRIMARY KEY (found_item_id)
);

create table public.found_items (
  id uuid default gen_random_uuid() not null,
  logged_by uuid default auth.uid(),
  title text not null,
  description text not null,
  category_id smallint not null,
  location_id smallint,
  date_found date default CURRENT_DATE not null,
  photo_paths text[] default '{}'::text[] not null,
  attributes jsonb default '{}'::jsonb not null,
  status found_status default 'in_custody'::found_status not null,
  is_hidden boolean default false not null,
  hidden_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  closed_at timestamp with time zone,
  search tsvector generated always as (to_tsvector('simple'::regconfig, ((title || ' '::text) || description))) stored,
  ref text default ('BG-'::text || nextval('found_items_ref_seq'::regclass)) not null,
  location_detail text,
  hold_until date,
  disposal_note text,
  disposed_by uuid,
  constraint found_items_pkey PRIMARY KEY (id),
  constraint found_items_description_check CHECK (((char_length(description) >= 10) AND (char_length(description) <= 2000))),
  constraint found_items_disposal_note_check CHECK ((char_length(disposal_note) <= 500)),
  constraint found_items_location_detail_check CHECK ((char_length(location_detail) <= 200)),
  constraint found_items_photo_paths_check CHECK ((cardinality(photo_paths) <= 3)),
  constraint found_items_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 100)))
);

create table public.locations (
  id smallint generated always as identity,
  name text not null,
  sort_order smallint default 0 not null,
  archived boolean default false not null,
  constraint locations_name_key UNIQUE (name),
  constraint locations_pkey PRIMARY KEY (id)
);

create table public.lost_report_private (
  lost_report_id uuid not null,
  private_details text default ''::text not null,
  updated_at timestamp with time zone default now() not null,
  constraint lost_report_private_pkey PRIMARY KEY (lost_report_id),
  constraint lost_report_private_private_details_check CHECK ((char_length(private_details) <= 1000))
);

create table public.lost_reports (
  id uuid default gen_random_uuid() not null,
  reporter_id uuid default auth.uid() not null,
  title text not null,
  description text not null,
  category_id smallint not null,
  location_id smallint,
  date_lost date not null,
  photo_paths text[] default '{}'::text[] not null,
  attributes jsonb default '{}'::jsonb not null,
  status lost_status default 'active'::lost_status not null,
  is_hidden boolean default false not null,
  hidden_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  closed_at timestamp with time zone,
  search tsvector generated always as (to_tsvector('simple'::regconfig, ((title || ' '::text) || description))) stored,
  ref text default ('LR-'::text || nextval('lost_reports_ref_seq'::regclass)) not null,
  status_note text,
  renewed_at timestamp with time zone,
  expiry_reminded_at timestamp with time zone,
  constraint lost_reports_pkey PRIMARY KEY (id),
  constraint lost_reports_description_check CHECK (((char_length(description) >= 10) AND (char_length(description) <= 2000))),
  constraint lost_reports_photo_paths_check CHECK ((cardinality(photo_paths) <= 3)),
  constraint lost_reports_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 100)))
);

create table public.match_suggestions (
  id uuid default gen_random_uuid() not null,
  lost_report_id uuid not null,
  found_item_id uuid not null,
  rank smallint not null,
  likelihood match_likelihood not null,
  explanation text not null,
  prefilter_score numeric default 0 not null,
  model text,
  created_at timestamp with time zone default now() not null,
  constraint match_suggestions_lost_report_id_found_item_id_key UNIQUE (lost_report_id, found_item_id),
  constraint match_suggestions_pkey PRIMARY KEY (id)
);

create table public.notifications (
  id bigint generated always as identity,
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean default false not null,
  emailed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint notifications_pkey PRIMARY KEY (id)
);

create table public.office_settings (
  id boolean default true not null,
  office_name text default '[Office name, Building]'::text not null,
  pickup_days integer default 5 not null,
  report_expiry_days integer default 90 not null,
  holding_days integer default 60 not null,
  updated_at timestamp with time zone default now() not null,
  constraint office_settings_pkey PRIMARY KEY (id),
  constraint office_settings_holding_days_check CHECK (((holding_days >= 7) AND (holding_days <= 365))),
  constraint office_settings_id_check CHECK (id),
  constraint office_settings_pickup_days_check CHECK (((pickup_days >= 1) AND (pickup_days <= 30))),
  constraint office_settings_report_expiry_days_check CHECK (((report_expiry_days >= 7) AND (report_expiry_days <= 365)))
);

create table public.profiles (
  id uuid not null,
  full_name text not null,
  email text not null,
  role user_role default 'student'::user_role not null,
  is_active boolean default true not null,
  consent_at timestamp with time zone,
  consent_version text,
  created_at timestamp with time zone default now() not null,
  constraint profiles_email_key UNIQUE (email),
  constraint profiles_pkey PRIMARY KEY (id)
);

create table public.proof_questions (
  id bigint generated always as identity,
  category_id smallint,
  question text not null,
  is_active boolean default true not null,
  constraint proof_questions_pkey PRIMARY KEY (id)
);

create table public.status_history (
  id bigint generated always as identity,
  entity_type text not null,
  entity_id uuid not null,
  old_status text,
  new_status text not null,
  changed_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint status_history_pkey PRIMARY KEY (id),
  constraint status_history_entity_type_check CHECK ((entity_type = ANY (ARRAY['lost_report'::text, 'found_item'::text, 'claim'::text])))
);

create table public.status_transitions (
  entity_type text not null,
  from_status text not null,
  to_status text not null,
  constraint status_transitions_pkey PRIMARY KEY (entity_type, from_status, to_status)
);

-- Foreign keys
alter table public.admin_activity add constraint admin_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.claim_answers add constraint claim_answers_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
alter table public.claim_messages add constraint claim_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.claim_messages add constraint claim_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES claim_threads(id) ON DELETE CASCADE;
alter table public.claim_threads add constraint claim_threads_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
alter table public.claims add constraint claims_claimant_id_fkey FOREIGN KEY (claimant_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.claims add constraint claims_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.claims add constraint claims_found_item_id_fkey FOREIGN KEY (found_item_id) REFERENCES found_items(id) ON DELETE CASCADE;
alter table public.claims add constraint claims_lost_report_id_fkey FOREIGN KEY (lost_report_id) REFERENCES lost_reports(id) ON DELETE SET NULL;
alter table public.claims add constraint claims_released_by_fkey FOREIGN KEY (released_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.flags add constraint flags_flagged_by_fkey FOREIGN KEY (flagged_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.flags add constraint flags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.found_item_private add constraint found_item_private_found_item_id_fkey FOREIGN KEY (found_item_id) REFERENCES found_items(id) ON DELETE CASCADE;
alter table public.found_items add constraint found_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id);
alter table public.found_items add constraint found_items_disposed_by_fkey FOREIGN KEY (disposed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.found_items add constraint found_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id);
alter table public.found_items add constraint found_items_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.lost_report_private add constraint lost_report_private_lost_report_id_fkey FOREIGN KEY (lost_report_id) REFERENCES lost_reports(id) ON DELETE CASCADE;
alter table public.lost_reports add constraint lost_reports_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id);
alter table public.lost_reports add constraint lost_reports_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id);
alter table public.lost_reports add constraint lost_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.match_suggestions add constraint match_suggestions_found_item_id_fkey FOREIGN KEY (found_item_id) REFERENCES found_items(id) ON DELETE CASCADE;
alter table public.match_suggestions add constraint match_suggestions_lost_report_id_fkey FOREIGN KEY (lost_report_id) REFERENCES lost_reports(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.proof_questions add constraint proof_questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
alter table public.status_history add constraint status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX admin_activity_actor_idx ON public.admin_activity USING btree (actor_id);
CREATE INDEX admin_activity_created_idx ON public.admin_activity USING btree (created_at DESC);
CREATE INDEX ai_jobs_due_idx ON public.ai_jobs USING btree (status, run_after);
CREATE UNIQUE INDEX ai_jobs_one_active ON public.ai_jobs USING btree (job_type, target_id) WHERE (status = ANY (ARRAY['queued'::job_status, 'processing'::job_status]));
CREATE INDEX claim_messages_thread_idx ON public.claim_messages USING btree (thread_id, created_at);
CREATE INDEX claims_claimant_idx ON public.claims USING btree (claimant_id);
CREATE INDEX claims_found_item_idx ON public.claims USING btree (found_item_id);
CREATE UNIQUE INDEX claims_one_open_per_user_item ON public.claims USING btree (found_item_id, claimant_id) WHERE (status = ANY (ARRAY['pending'::claim_status, 'needs_info'::claim_status, 'approved'::claim_status]));
CREATE UNIQUE INDEX claims_ref_key ON public.claims USING btree (ref);
CREATE INDEX claims_status_idx ON public.claims USING btree (status);
CREATE UNIQUE INDEX flags_one_per_user_target ON public.flags USING btree (flagged_by, target_type, target_id);
CREATE INDEX flags_open_idx ON public.flags USING btree (status, target_type, target_id);
CREATE INDEX found_items_category_idx ON public.found_items USING btree (category_id);
CREATE UNIQUE INDEX found_items_ref_key ON public.found_items USING btree (ref);
CREATE INDEX found_items_search_idx ON public.found_items USING gin (search);
CREATE INDEX found_items_status_idx ON public.found_items USING btree (status, date_found);
CREATE INDEX lost_reports_category_idx ON public.lost_reports USING btree (category_id);
CREATE UNIQUE INDEX lost_reports_ref_key ON public.lost_reports USING btree (ref);
CREATE INDEX lost_reports_reporter_idx ON public.lost_reports USING btree (reporter_id);
CREATE INDEX lost_reports_search_idx ON public.lost_reports USING gin (search);
CREATE INDEX lost_reports_status_idx ON public.lost_reports USING btree (status, created_at);
CREATE INDEX match_suggestions_lost_idx ON public.match_suggestions USING btree (lost_report_id, rank);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX status_history_entity_idx ON public.status_history USING btree (entity_type, entity_id, created_at);

-- Functions (public = callable by the app where granted below; private = internal helpers)
CREATE OR REPLACE FUNCTION private.activity_claims()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item public.found_items;
  href   text := '/admin/claims/' || new.ref;
begin
  select * into v_item from public.found_items where id = new.found_item_id;
  if new.status = 'approved' then
    perform private.log_activity('approved', 'approved claim ' || new.ref, v_item.title, href);
  elsif new.status = 'rejected' then
    perform private.log_activity('rejected', 'rejected claim ' || new.ref, v_item.title, href);
  elsif new.status = 'needs_info' then
    perform private.log_activity('asked', 'asked for more details on claim ' || new.ref, v_item.title, href);
  elsif new.status = 'completed' then
    perform private.log_activity('released', 'released ' || v_item.ref || ' to the claimant', v_item.title, '/admin/items/' || v_item.ref);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.activity_found_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare href text := '/admin/items/' || new.ref;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity('logged', 'logged ' || new.ref, new.title, href);
    return new;
  end if;
 
  if new.status is distinct from old.status then
    if new.status::text = 'in_custody' and old.status::text = 'ready_for_pickup' then
      perform private.log_activity('returned_to_custody', 'put ' || new.ref || ' back on the shelf', new.title, href);
    elsif new.status::text = 'donated' then
      perform private.log_activity('donated', 'donated ' || new.ref, new.title, href);
    elsif new.status::text = 'disposed' then
      perform private.log_activity('disposed', 'disposed of ' || new.ref, new.title, href);
    end if;
  end if;
 
  if new.is_hidden is distinct from old.is_hidden then
    perform private.log_activity(case when new.is_hidden then 'hid' else 'unhid' end,
      case when new.is_hidden then 'hid found item ' else 'made visible found item ' end || new.ref, new.title, href);
  end if;
 
  if new.hold_until is distinct from old.hold_until and new.hold_until is not null then
    perform private.log_activity('extended', 'kept ' || new.ref || ' until ' || to_char(new.hold_until, 'Mon DD, YYYY'), new.title, href);
  end if;
 
  if (new.title, new.description, new.category_id, new.location_id, new.location_detail, new.date_found, new.photo_paths)
     is distinct from
     (old.title, old.description, old.category_id, old.location_id, old.location_detail, old.date_found, old.photo_paths) then
    perform private.log_activity('edited', 'edited ' || new.ref, new.title, href);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.activity_lost_reports()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.log_activity(case when new.is_hidden then 'hid' else 'unhid' end,
    case when new.is_hidden then 'hid lost report ' else 'made visible lost report ' end || new.ref,
    new.title, '/admin/lost/' || new.ref);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.activity_places()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare kind_label text := case tg_table_name when 'categories' then 'category' else 'location' end;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity('places', 'added ' || kind_label || ' ' || new.name, null, null);
  elsif tg_op = 'DELETE' then
    perform private.log_activity('places', 'removed ' || kind_label || ' ' || old.name, null, null);
    return old;
  else
    if new.name is distinct from old.name then
      perform private.log_activity('places', 'renamed ' || kind_label || ' ' || old.name || ' to ' || new.name, null, null);
    end if;
    if new.archived is distinct from old.archived then
      perform private.log_activity('places', case when new.archived then 'archived ' else 'restored ' end || kind_label || ' ' || new.name, null, null);
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.activity_profiles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.role is distinct from old.role then
    perform private.log_activity('admins', 'changed ' || new.full_name || '''s role to ' || replace(new.role::text, '_', ' '), null, null);
  end if;
  if new.is_active is distinct from old.is_active then
    perform private.log_activity('admins', case when new.is_active then 'reactivated ' else 'deactivated ' end || new.full_name || '''s account', null, null);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.add_business_days(p_from timestamp with time zone, p_days integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  d timestamptz := p_from;
  n int := p_days;
begin
  while n > 0 loop
    d := d + interval '1 day';
    if extract(isodow from d) < 6 then   -- Mon–Fri = 1..5
      n := n - 1;
    end if;
  end loop;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION private.attribute_overlap(a jsonb, b jsonb)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select
    (case when a->>'item_type' is not null and lower(a->>'item_type') = lower(b->>'item_type') then 2 else 0 end)
  + (case when a->>'brand'     is not null and lower(a->>'brand')     = lower(b->>'brand')     then 2 else 0 end)
  + (case when a->>'material'  is not null and lower(a->>'material')  = lower(b->>'material')  then 1 else 0 end)
  + (select count(*)::int from (
       select lower(x) from jsonb_array_elements_text(
         case when jsonb_typeof(a->'colors') = 'array' then a->'colors' else '[]'::jsonb end) x
       intersect
       select lower(y) from jsonb_array_elements_text(
         case when jsonb_typeof(b->'colors') = 'array' then b->'colors' else '[]'::jsonb end) y
     ) c);
$function$
;

CREATE OR REPLACE FUNCTION private.enforce_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  entity text := tg_argv[0];
begin
  if new.status is distinct from old.status then
    if not exists (
      select 1 from public.status_transitions t
      where t.entity_type = entity
        and t.from_status = old.status::text
        and t.to_status   = new.status::text
    ) then
      raise exception 'Illegal % status change: % -> %', entity, old.status, new.status
        using errcode = '23514';
    end if;
    insert into public.status_history (entity_type, entity_id, old_status, new_status, changed_by)
    values (entity, new.id, old.status::text, new.status::text, auth.uid());
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.enqueue_extraction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.ai_jobs (job_type, target_type, target_id)
  values ('extract_attributes', tg_argv[0], new.id)
  on conflict do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen     text  := meta->>'role';
  final_role public.user_role := 'student';
begin
  if lower(new.email) not like '%@rtu.edu.ph' then
    raise exception 'Please register with your RTU email address.';
  end if;
 
  if chosen in ('student', 'faculty', 'staff') then
    final_role := chosen::public.user_role;
  end if;
 
  insert into public.profiles (id, full_name, email, role, consent_at, consent_version)
  values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    final_role,
    case when meta->>'consent_version' is not null then now() end,
    meta->>'consent_version'
  );
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.log_activity(p_kind text, p_text text, p_subject text, p_href text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if public.is_admin() then
    insert into public.admin_activity (actor_id, kind, text, subject, href)
    values (auth.uid(), p_kind, p_text, p_subject, p_href);
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.log_initial_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.status_history (entity_type, entity_id, old_status, new_status, changed_by)
  values (tg_argv[0], new.id, null, new.status::text, auth.uid());
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, p_type, p_title, p_body, p_link);
$function$
;

CREATE OR REPLACE FUNCTION private.notify_admins(p_type text, p_title text, p_body text, p_link text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.role::text in ('admin', 'super_admin') and p.is_active;
$function$
;

CREATE OR REPLACE FUNCTION private.on_flag_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_title text;
begin
  if new.target_type = 'lost_report' then
    select title into v_title from public.lost_reports where id = new.target_id;
  else
    select title into v_title from public.found_items where id = new.target_id;
  end if;
  perform private.notify_admins('flagged', 'A post was flagged', coalesce(v_title, '') || ' · ' || new.reason, '/admin/flagged');
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.on_lost_report_edited()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.is_hidden and not public.is_admin() then
    new.status_note := 'Edited. Waiting for the office to review it again.';
    perform private.notify_admins('report_edited', 'A hidden report was edited', new.title, '/admin/lost/' || new.ref);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin new.updated_at := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION private.settings()
 RETURNS office_settings
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select * from public.office_settings where id;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_claim(p_claim_id uuid, p_decision text, p_reason text DEFAULT NULL::text, p_pickup_office text DEFAULT NULL::text, p_pickup_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_claim public.claims;
  v_set   public.office_settings := private.settings();
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
 
  select * into v_claim from public.claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status not in ('pending', 'needs_info') then raise exception 'This claim was already decided'; end if;
 
  if p_decision = 'approve' then
    update public.claims
       set status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason,
           pickup_office = coalesce(p_pickup_office, v_set.office_name),
           pickup_at = p_pickup_at,
           pickup_deadline = private.add_business_days(now(), v_set.pickup_days)
     where id = p_claim_id;
 
    update public.found_items set status = 'ready_for_pickup'
     where id = v_claim.found_item_id and status = 'claim_pending';
 
    -- Any other open claims on the same item are closed automatically
    with rej as (
      update public.claims
         set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
             decision_reason = 'Another claim for this item was approved.'
       where found_item_id = v_claim.found_item_id and id <> p_claim_id and status in ('pending', 'needs_info')
       returning id, ref, claimant_id
    ), closed as (
      update public.claim_threads set is_closed = true, closed_at = now()
       where claim_id in (select id from rej)
       returning claim_id
    )
    insert into public.notifications (user_id, type, title, body, link)
    select claimant_id, 'claim_rejected', 'Claim not approved', 'Another claim for this item was approved.', '/claims/' || ref
    from rej;
 
    perform private.notify(v_claim.claimant_id, 'claim_approved', 'Claim approved',
      'Please pick up your item within ' || v_set.pickup_days || ' working days at '
        || coalesce(p_pickup_office, v_set.office_name) || '. Bring your RTU ID.',
      '/claims/' || v_claim.ref);
 
  elsif p_decision = 'reject' then
    if p_reason is null or trim(p_reason) = '' then raise exception 'Please give a reason for rejecting'; end if;
 
    update public.claims
       set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason
     where id = p_claim_id;
    update public.claim_threads set is_closed = true, closed_at = now() where claim_id = p_claim_id;
 
    if not exists (select 1 from public.claims
                    where found_item_id = v_claim.found_item_id and id <> p_claim_id
                      and status in ('pending', 'needs_info', 'approved')) then
      update public.found_items set status = 'in_custody'
       where id = v_claim.found_item_id and status = 'claim_pending';
    end if;
 
    perform private.notify(v_claim.claimant_id, 'claim_rejected', 'Claim not approved', p_reason, '/claims/' || v_claim.ref);
  else
    raise exception 'p_decision must be approve or reject';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_dispose_item(p_id uuid, p_method text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item public.found_items;
  v_ends date;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_method not in ('donated', 'disposed') then raise exception 'p_method must be donated or disposed'; end if;
  if p_note is null or char_length(trim(p_note)) < 3 then raise exception 'Please add a short note'; end if;
 
  select * into v_item from public.found_items where id = p_id for update;
  if not found then raise exception 'Item not found'; end if;
 
  v_ends := coalesce(v_item.hold_until, v_item.date_found + (private.settings()).holding_days);
  if v_item.status::text <> 'in_custody'
     or v_ends >= (now() at time zone 'Asia/Manila')::date
     or exists (select 1 from public.claims
                 where found_item_id = p_id and status in ('pending', 'needs_info', 'approved')) then
    raise exception 'This item has an open claim or is still within its holding period.';
  end if;
 
  update public.found_items
     set status = p_method::public.found_status, disposal_note = trim(p_note),
         disposed_by = auth.uid(), closed_at = now()
   where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_return_to_custody(p_claim_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_claim public.claims;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into v_claim from public.claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'approved' then raise exception 'Only an approved claim can be returned to custody'; end if;
 
  update public.claims set status = 'expired' where id = p_claim_id;
  update public.found_items set status = 'in_custody'
   where id = v_claim.found_item_id and status = 'ready_for_pickup';
  update public.claim_threads set is_closed = true, closed_at = now() where claim_id = p_claim_id;
  perform private.notify(v_claim.claimant_id, 'pickup_expired', 'Pickup window expired',
    'The item was not picked up, so it went back to the office shelf. Contact the office if you still need it.',
    '/claims/' || v_claim.ref);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_active(p_user uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_super_admin() then raise exception 'Super admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot deactivate your own account'; end if;
  update public.profiles set is_active = p_active where id = p_user;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_found_status(p_id uuid, p_new found_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.found_items set status = p_new where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_hidden(p_entity text, p_id uuid, p_hidden boolean, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_report public.lost_reports;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
 
  if p_entity = 'lost_report' then
    update public.lost_reports
       set is_hidden = p_hidden,
           hidden_reason = case when p_hidden then p_reason end,
           status_note = case when p_hidden then 'Hidden by the office' || coalesce(': ' || p_reason, '.') end
     where id = p_id
     returning * into v_report;
    if p_hidden and v_report.id is not null then
      perform private.notify(v_report.reporter_id, 'report_hidden', 'Your lost report was hidden',
                             coalesce(p_reason, 'It did not follow the posting rules.'), '/my-reports/' || v_report.ref);
    end if;
  elsif p_entity = 'found_item' then
    update public.found_items
       set is_hidden = p_hidden, hidden_reason = case when p_hidden then p_reason end
     where id = p_id;
  else
    raise exception 'p_entity must be lost_report or found_item';
  end if;
 
  update public.flags
     set status = case when p_hidden then 'actioned' else 'dismissed' end,
         resolved_by = auth.uid(), resolved_at = now()
   where target_type = p_entity and target_id = p_id and status = 'open';
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user uuid, p_role user_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_super_admin() then raise exception 'Super admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $function$
;

CREATE OR REPLACE FUNCTION public.candidate_matches(p_kind text, p_id uuid, p_limit integer DEFAULT 20, p_window_days integer DEFAULT 60)
 RETURNS TABLE(candidate_id uuid, prefilter_score numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_kind = 'lost_report' then
    return query
    select f.id,
           (  case when f.category_id = l.category_id then 3 else 0 end
            + case when l.location_id is not null and f.location_id = l.location_id then 2 else 0 end
            + private.attribute_overlap(l.attributes, f.attributes))::numeric
    from public.lost_reports l
    join public.found_items f
      on f.status in ('in_custody','claim_pending') and not f.is_hidden
     and f.date_found >= l.date_lost - 1
     and f.date_found <= l.date_lost + p_window_days
    where l.id = p_id
    order by 2 desc, f.date_found desc
    limit p_limit;

  elsif p_kind = 'found_item' then
    return query
    select l.id,
           (  case when f.category_id = l.category_id then 3 else 0 end
            + case when l.location_id is not null and f.location_id = l.location_id then 2 else 0 end
            + private.attribute_overlap(l.attributes, f.attributes))::numeric
    from public.found_items f
    join public.lost_reports l
      on l.status = 'active' and not l.is_hidden
     and l.date_lost <= f.date_found + 1
     and l.date_lost >= f.date_found - p_window_days
    where f.id = p_id
    order by 2 desc, l.created_at desc
    limit p_limit;

  else
    raise exception 'p_kind must be lost_report or found_item';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.complete_handover(p_claim_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_claim public.claims;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;

  select * into v_claim from public.claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'approved' then raise exception 'Only approved claims can be handed over'; end if;

  update public.claims set status = 'completed', released_by = auth.uid(), released_at = now()
   where id = p_claim_id;
  update public.found_items set status = 'returned', closed_at = now()
   where id = v_claim.found_item_id;
  if v_claim.lost_report_id is not null then
    update public.lost_reports set status = 'resolved', closed_at = now()
     where id = v_claim.lost_report_id and status = 'active';
  end if;
  update public.claim_threads set is_closed = true, closed_at = now() where claim_id = p_claim_id;

  perform private.notify(v_claim.claimant_id, 'item_returned', 'Item returned',
                         'The handover was recorded. Thank you!', '/claims/' || p_claim_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text in ('admin', 'super_admin') and p.is_active
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text = 'super_admin' and p.is_active
  );
$function$
;

CREATE OR REPLACE FUNCTION public.purge_old_records(p_days integer DEFAULT 365)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - make_interval(days => p_days);
  n1 int; n2 int; n3 int; n4 int;
begin
  delete from public.lost_reports where status in ('resolved', 'closed', 'expired') and closed_at < cutoff;
  get diagnostics n1 = row_count;
  delete from public.found_items where status::text in ('returned', 'donated', 'disposed') and closed_at < cutoff;
  get diagnostics n2 = row_count;
  delete from public.status_history h
   where h.created_at < cutoff
     and not exists (select 1 from public.lost_reports r where r.id = h.entity_id)
     and not exists (select 1 from public.found_items f where f.id = h.entity_id)
     and not exists (select 1 from public.claims c where c.id = h.entity_id);
  get diagnostics n3 = row_count;
  delete from public.admin_activity where created_at < cutoff;
  get diagnostics n4 = row_count;
  return n1 + n2 + n3 + n4;
end $function$
;

CREATE OR REPLACE FUNCTION public.run_expiry_sweep()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n    int;
  v_days int := (private.settings()).report_expiry_days;
begin
  with expired as (
    update public.lost_reports
       set status = 'expired', closed_at = now(), status_note = null
     where status = 'active'
       and coalesce(renewed_at, created_at) < now() - make_interval(days => v_days)
     returning id, ref, reporter_id, title
  )
  insert into public.notifications (user_id, type, title, body, link)
  select reporter_id, 'report_expired', 'Your lost report has expired', title, '/my-reports/' || ref
  from expired;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.run_pickup_expiry_sweep()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  with expired as (
    update public.claims set status = 'expired'
     where status = 'approved' and pickup_deadline < now()
     returning id, ref, claimant_id, found_item_id
  ), reopened as (
    update public.found_items set status = 'in_custody'
     where id in (select found_item_id from expired) and status = 'ready_for_pickup'
     returning id
  ), closed_threads as (
    update public.claim_threads set is_closed = true, closed_at = now()
     where claim_id in (select id from expired)
     returning claim_id
  )
  insert into public.notifications (user_id, type, title, body, link)
  select claimant_id, 'pickup_expired', 'Pickup window expired',
         'The pickup window for your approved claim has passed. Please contact the office if you still need this item.',
         '/claims/' || ref
  from expired;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.run_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n1 int; n2 int;
  v_days int := (private.settings()).report_expiry_days;
begin
  with due as (
    update public.lost_reports
       set expiry_reminded_at = now()
     where status = 'active' and not is_hidden and expiry_reminded_at is null
       and coalesce(renewed_at, created_at) < now() - make_interval(days => greatest(v_days - 7, 1))
     returning ref, reporter_id, title
  )
  insert into public.notifications (user_id, type, title, body, link)
  select reporter_id, 'report_expiring', 'Your lost report expires in 7 days',
         title || ' · Renew it if you are still looking.', '/my-reports/' || ref
  from due;
  get diagnostics n1 = row_count;
 
  with due as (
    update public.claims
       set pickup_reminded_at = now()
     where status = 'approved' and pickup_reminded_at is null
       and pickup_deadline < now() + interval '1 day'
     returning ref, claimant_id
  ), to_owner as (
    insert into public.notifications (user_id, type, title, body, link)
    select claimant_id, 'pickup_reminder', 'Pick up your item by tomorrow',
           'Bring your RTU ID to the office.', '/claims/' || ref
    from due
    returning 1
  )
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'pickup_due', 'A pickup is due tomorrow', 'Claim ' || d.ref, '/admin/claims/' || d.ref
  from due d cross join public.profiles p
  where p.role::text in ('admin', 'super_admin') and p.is_active;
  get diagnostics n2 = row_count;
 
  return n1 + n2;
end $function$
;

CREATE OR REPLACE FUNCTION public.send_message(p_claim_id uuid, p_body text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean := public.is_admin();
  v_claim  public.claims;
  v_thread public.claim_threads;
  v_body   text := trim(coalesce(p_body, ''));
  v_id     bigint;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  select * into v_claim from public.claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not v_admin and v_claim.claimant_id <> v_uid then raise exception 'Not allowed'; end if;

  select * into v_thread from public.claim_threads where claim_id = p_claim_id;
  if not found or v_thread.is_closed or v_claim.status in ('rejected','withdrawn','completed') then
    raise exception 'This conversation is closed';
  end if;

  if char_length(v_body) not between 1 and 1000 then
    raise exception 'Message must be 1 to 1000 characters';
  end if;

  if v_body ~* '(\+?\d[\d\s\-]{7,}\d)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|(https?://|www\.)|(facebook|messenger|instagram|viber|telegram|whatsapp|fb\.com|m\.me)' then
    raise exception 'Please do not share contact details or links. Use this thread instead.';
  end if;

  if (select count(*) from public.claim_messages m
       where m.thread_id = v_thread.id and m.sender_id = v_uid
         and m.created_at > now() - interval '1 minute') >= 5 then
    raise exception 'You are sending messages too fast. Please wait a moment.';
  end if;

  insert into public.claim_messages (thread_id, sender_id, sender_alias, body)
  values (v_thread.id, v_uid, case when v_admin then 'Office' else 'Owner' end, v_body)
  returning id into v_id;

  if v_admin and v_claim.status = 'pending' then
    update public.claims set status = 'needs_info' where id = p_claim_id;
  elsif not v_admin and v_claim.status = 'needs_info' then
    update public.claims set status = 'pending' where id = p_claim_id;
  end if;

  if v_admin then
    perform private.notify(v_claim.claimant_id, 'new_message', 'New message from the Office',
                           null, '/claims/' || p_claim_id);
  else
    perform private.notify_admins('new_message', 'New message on a claim',
                                  null, '/admin/claims/' || p_claim_id);
  end if;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_lost_report_status(p_id uuid, p_new lost_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin  boolean := public.is_admin();
  v_report public.lost_reports;
begin
  select * into v_report from public.lost_reports where id = p_id for update;
  if not found or not (v_admin or v_report.reporter_id = auth.uid()) then
    raise exception 'Report not found';
  end if;
  if not v_admin
     and not (p_new in ('resolved', 'closed') or (p_new = 'active' and v_report.status = 'expired')) then
    raise exception 'You can only mark your report as resolved or closed, or renew an expired one';
  end if;
 
  update public.lost_reports
     set status             = p_new,
         closed_at          = case when p_new = 'active' then null else now() end,
         renewed_at         = case when p_new = 'active' then now() else renewed_at end,
         expiry_reminded_at = case when p_new = 'active' then null else expiry_reminded_at end,
         status_note        = case
                                when p_new = 'resolved' and not v_admin then 'You marked this item as found.'
                                when p_new = 'active' then null
                                else status_note
                              end
   where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_claim(p_found_item_id uuid, p_lost_report_id uuid, p_answers jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid          uuid := auth.uid();
  v_found        public.found_items;
  v_claim_id     uuid;
  v_answer       jsonb;
  v_open_count   int;
  v_attempt_count int;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  select * into v_found from public.found_items
   where id = p_found_item_id and not is_hidden;
  if not found then raise exception 'Item not found'; end if;
  if v_found.status not in ('in_custody','claim_pending') then
    raise exception 'This item can no longer be claimed';
  end if;

  if p_lost_report_id is not null and not exists (
       select 1 from public.lost_reports where id = p_lost_report_id and reporter_id = v_uid) then
    raise exception 'Invalid lost report';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Please answer the proof questions';
  end if;

  -- Cap 1: at most 3 open claims on this item at once
  select count(*) into v_open_count from public.claims
   where found_item_id = p_found_item_id and status in ('pending','needs_info');
  if v_open_count >= 3 then
    raise exception 'This item already has the maximum number of pending claims. Please check back later.';
  end if;

  -- Cap 2: at most 2 attempts per person per item, ever
  select count(*) into v_attempt_count from public.claims
   where found_item_id = p_found_item_id and claimant_id = v_uid;
  if v_attempt_count >= 2 then
    raise exception 'You have reached the maximum number of claim attempts for this item. Please visit the office directly.';
  end if;

  insert into public.claims (found_item_id, lost_report_id, claimant_id)
  values (p_found_item_id, p_lost_report_id, v_uid)
  returning id into v_claim_id;

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    insert into public.claim_answers (claim_id, question_text, answer_text)
    values (v_claim_id,
            left(coalesce(v_answer->>'question', ''), 300),
            left(coalesce(nullif(trim(v_answer->>'answer'), ''), '(no answer)'), 1000));
  end loop;

  insert into public.claim_threads (claim_id) values (v_claim_id);

  if v_found.status = 'in_custody' then
    update public.found_items set status = 'claim_pending' where id = v_found.id;
  end if;

  perform private.notify_admins('claim_submitted', 'New claim to review', v_found.title,
                                '/admin/claims/' || v_claim_id);
  return v_claim_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.withdraw_claim(p_claim_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_claim public.claims;
begin
  select * into v_claim from public.claims
   where id = p_claim_id and claimant_id = auth.uid() for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status not in ('pending','needs_info','approved') then
    raise exception 'This claim can no longer be withdrawn';
  end if;

  update public.claims set status = 'withdrawn' where id = p_claim_id;
  update public.claim_threads set is_closed = true, closed_at = now() where claim_id = p_claim_id;

  if not exists (select 1 from public.claims
                  where found_item_id = v_claim.found_item_id and id <> p_claim_id
                    and status in ('pending','needs_info','approved')) then
    update public.found_items set status = 'in_custody'
     where id = v_claim.found_item_id and status in ('claim_pending','ready_for_pickup');
  end if;

  perform private.notify_admins('claim_withdrawn', 'A claim was withdrawn', null,
                                '/admin/claims/' || p_claim_id);
end $function$
;

-- Triggers (including the sign-up trigger on auth.users)
CREATE TRIGGER trg_ai_jobs_updated BEFORE UPDATE ON public.ai_jobs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER categories_activity AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.activity_places();
CREATE TRIGGER claim_activity AFTER UPDATE OF status ON public.claims FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION private.activity_claims();
CREATE TRIGGER claim_initial_status AFTER INSERT ON public.claims FOR EACH ROW EXECUTE FUNCTION private.log_initial_status('claim');
CREATE TRIGGER claim_status_guard BEFORE UPDATE OF status ON public.claims FOR EACH ROW EXECUTE FUNCTION private.enforce_status_transition('claim');
CREATE TRIGGER trg_claims_updated BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER flags_notify AFTER INSERT ON public.flags FOR EACH ROW EXECUTE FUNCTION private.on_flag_created();
CREATE TRIGGER trg_found_private_updated BEFORE UPDATE ON public.found_item_private FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER found_activity AFTER INSERT OR UPDATE ON public.found_items FOR EACH ROW EXECUTE FUNCTION private.activity_found_items();
CREATE TRIGGER found_enqueue_ai AFTER INSERT ON public.found_items FOR EACH ROW EXECUTE FUNCTION private.enqueue_extraction('found_item');
CREATE TRIGGER found_initial_status AFTER INSERT ON public.found_items FOR EACH ROW EXECUTE FUNCTION private.log_initial_status('found_item');
CREATE TRIGGER found_requeue_ai AFTER UPDATE OF title, description ON public.found_items FOR EACH ROW WHEN (((old.title IS DISTINCT FROM new.title) OR (old.description IS DISTINCT FROM new.description))) EXECUTE FUNCTION private.enqueue_extraction('found_item');
CREATE TRIGGER found_status_guard BEFORE UPDATE OF status ON public.found_items FOR EACH ROW EXECUTE FUNCTION private.enforce_status_transition('found_item');
CREATE TRIGGER trg_found_items_updated BEFORE UPDATE ON public.found_items FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER locations_activity AFTER INSERT OR DELETE OR UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.activity_places();
CREATE TRIGGER trg_lost_private_updated BEFORE UPDATE ON public.lost_report_private FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER lost_activity AFTER UPDATE OF is_hidden ON public.lost_reports FOR EACH ROW WHEN ((old.is_hidden IS DISTINCT FROM new.is_hidden)) EXECUTE FUNCTION private.activity_lost_reports();
CREATE TRIGGER lost_edited_note BEFORE UPDATE OF title, description, category_id, location_id, date_lost, photo_paths ON public.lost_reports FOR EACH ROW WHEN (((((((old.title IS DISTINCT FROM new.title) OR (old.description IS DISTINCT FROM new.description)) OR (old.category_id IS DISTINCT FROM new.category_id)) OR (old.location_id IS DISTINCT FROM new.location_id)) OR (old.date_lost IS DISTINCT FROM new.date_lost)) OR (old.photo_paths IS DISTINCT FROM new.photo_paths))) EXECUTE FUNCTION private.on_lost_report_edited();
CREATE TRIGGER lost_enqueue_ai AFTER INSERT ON public.lost_reports FOR EACH ROW EXECUTE FUNCTION private.enqueue_extraction('lost_report');
CREATE TRIGGER lost_initial_status AFTER INSERT ON public.lost_reports FOR EACH ROW EXECUTE FUNCTION private.log_initial_status('lost_report');
CREATE TRIGGER lost_requeue_ai AFTER UPDATE OF title, description ON public.lost_reports FOR EACH ROW WHEN (((old.title IS DISTINCT FROM new.title) OR (old.description IS DISTINCT FROM new.description))) EXECUTE FUNCTION private.enqueue_extraction('lost_report');
CREATE TRIGGER lost_status_guard BEFORE UPDATE OF status ON public.lost_reports FOR EACH ROW EXECUTE FUNCTION private.enforce_status_transition('lost_report');
CREATE TRIGGER trg_lost_reports_updated BEFORE UPDATE ON public.lost_reports FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.office_settings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER profile_activity AFTER UPDATE OF role, is_active ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.activity_profiles();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Row-level security
alter table public.admin_activity enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.categories enable row level security;
alter table public.claim_answers enable row level security;
alter table public.claim_messages enable row level security;
alter table public.claim_threads enable row level security;
alter table public.claims enable row level security;
alter table public.flags enable row level security;
alter table public.found_item_private enable row level security;
alter table public.found_items enable row level security;
alter table public.locations enable row level security;
alter table public.lost_report_private enable row level security;
alter table public.lost_reports enable row level security;
alter table public.match_suggestions enable row level security;
alter table public.notifications enable row level security;
alter table public.office_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.proof_questions enable row level security;
alter table public.status_history enable row level security;
alter table public.status_transitions enable row level security;

-- Policies (public tables and the photo buckets)
create policy "activity read admin" on public.admin_activity as permissive for select to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "categories delete" on public.categories as permissive for delete to authenticated
  using (( SELECT is_super_admin() AS is_super_admin));
create policy "categories insert" on public.categories as permissive for insert to authenticated
  with check (( SELECT is_super_admin() AS is_super_admin));
create policy "categories read" on public.categories as permissive for select to authenticated
  using (true);
create policy "categories update" on public.categories as permissive for update to authenticated
  using (( SELECT is_super_admin() AS is_super_admin))
  with check (( SELECT is_super_admin() AS is_super_admin));
create policy "claim_answers read" on public.claim_answers as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM claims c
  WHERE ((c.id = claim_answers.claim_id) AND ((c.claimant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))))));
create policy "claim_messages read" on public.claim_messages as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM (claim_threads t
     JOIN claims c ON ((c.id = t.claim_id)))
  WHERE ((t.id = claim_messages.thread_id) AND ((c.claimant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))))));
create policy "claim_threads read" on public.claim_threads as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM claims c
  WHERE ((c.id = claim_threads.claim_id) AND ((c.claimant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))))));
create policy "claims read" on public.claims as permissive for select to authenticated
  using (((claimant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
create policy "flags insert own" on public.flags as permissive for insert to authenticated
  with check (((flagged_by = ( SELECT auth.uid() AS uid)) AND (((target_type = 'lost_report'::text) AND (EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.id = flags.target_id) AND (r.reporter_id <> ( SELECT auth.uid() AS uid)))))) OR ((target_type = 'found_item'::text) AND (EXISTS ( SELECT 1
   FROM found_items f
  WHERE (f.id = flags.target_id)))))));
create policy "flags read own or admin" on public.flags as permissive for select to authenticated
  using (((flagged_by = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
create policy "found private admin" on public.found_item_private as permissive for all to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "found insert admin" on public.found_items as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "found read visible" on public.found_items as permissive for select to authenticated
  using (((NOT is_hidden) OR ( SELECT is_admin() AS is_admin)));
create policy "found update admin" on public.found_items as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "locations delete" on public.locations as permissive for delete to authenticated
  using (( SELECT is_super_admin() AS is_super_admin));
create policy "locations insert" on public.locations as permissive for insert to authenticated
  with check (( SELECT is_super_admin() AS is_super_admin));
create policy "locations read" on public.locations as permissive for select to authenticated
  using (true);
create policy "locations update" on public.locations as permissive for update to authenticated
  using (( SELECT is_super_admin() AS is_super_admin))
  with check (( SELECT is_super_admin() AS is_super_admin));
create policy "lost private read" on public.lost_report_private as permissive for select to authenticated
  using ((( SELECT is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.id = lost_report_private.lost_report_id) AND (r.reporter_id = ( SELECT auth.uid() AS uid)))))));
create policy "lost private update own" on public.lost_report_private as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.id = lost_report_private.lost_report_id) AND (r.reporter_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.id = lost_report_private.lost_report_id) AND (r.reporter_id = ( SELECT auth.uid() AS uid))))));
create policy "lost private write own" on public.lost_report_private as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.id = lost_report_private.lost_report_id) AND (r.reporter_id = ( SELECT auth.uid() AS uid))))));
create policy "lost insert own" on public.lost_reports as permissive for insert to authenticated
  with check ((reporter_id = ( SELECT auth.uid() AS uid)));
create policy "lost read" on public.lost_reports as permissive for select to authenticated
  using ((((status = 'active'::lost_status) AND (NOT is_hidden)) OR (reporter_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
create policy "lost update own active" on public.lost_reports as permissive for update to authenticated
  using (((reporter_id = ( SELECT auth.uid() AS uid)) AND (status = 'active'::lost_status)))
  with check ((reporter_id = ( SELECT auth.uid() AS uid)));
create policy "matches read" on public.match_suggestions as permissive for select to authenticated
  using ((( SELECT is_admin() AS is_admin) OR ((EXISTS ( SELECT 1
   FROM lost_reports l
  WHERE ((l.id = match_suggestions.lost_report_id) AND (l.reporter_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM found_items f
  WHERE (f.id = match_suggestions.found_item_id))))));
create policy "notifications read own" on public.notifications as permissive for select to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "notifications update own" on public.notifications as permissive for update to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "settings read" on public.office_settings as permissive for select to anon, authenticated
  using (true);
create policy "settings super admin" on public.office_settings as permissive for update to authenticated
  using (( SELECT is_super_admin() AS is_super_admin))
  with check (( SELECT is_super_admin() AS is_super_admin));
create policy "profiles read own or admin" on public.profiles as permissive for select to authenticated
  using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
create policy "profiles update own" on public.profiles as permissive for update to authenticated
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));
create policy "proof_questions delete" on public.proof_questions as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "proof_questions insert" on public.proof_questions as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "proof_questions read" on public.proof_questions as permissive for select to authenticated
  using (true);
create policy "proof_questions update" on public.proof_questions as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "history read" on public.status_history as permissive for select to authenticated
  using ((( SELECT is_admin() AS is_admin) OR ((entity_type = 'lost_report'::text) AND (EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.id = status_history.entity_id) AND (r.reporter_id = ( SELECT auth.uid() AS uid)))))) OR ((entity_type = 'claim'::text) AND (EXISTS ( SELECT 1
   FROM claims c
  WHERE ((c.id = status_history.entity_id) AND (c.claimant_id = ( SELECT auth.uid() AS uid))))))));
create policy "found-photos admin delete" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'found-photos'::text) AND ( SELECT is_admin() AS is_admin)));
create policy "found-photos admin upload" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'found-photos'::text) AND ( SELECT is_admin() AS is_admin)));
create policy "found-photos read signed-in" on storage.objects as permissive for select to authenticated
  using ((bucket_id = 'found-photos'::text));
create policy "lost-photos delete own" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'lost-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "lost-photos read own or admin" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'lost-photos'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT is_admin() AS is_admin))));
create policy "lost-photos read public listing y0t93e_0" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'lost-photos'::text) AND (EXISTS ( SELECT 1
   FROM lost_reports r
  WHERE ((r.status = 'active'::lost_status) AND (NOT r.is_hidden) AND (objects.name = ANY (r.photo_paths)))))));
create policy "lost-photos upload own folder" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'lost-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('found-photos', 'found-photos', f, 2097152, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('lost-photos', 'lost-photos', f, 2097152, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;

-- Realtime
alter publication supabase_realtime add table public.claim_messages;
alter publication supabase_realtime add table public.notifications;

-- Table and column permissions for the browser (anon = signed out, authenticated = signed in)
revoke all on public.admin_activity from anon, authenticated;
revoke all on public.ai_jobs from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.claim_answers from anon, authenticated;
revoke all on public.claim_messages from anon, authenticated;
revoke all on public.claim_threads from anon, authenticated;
revoke all on public.claims from anon, authenticated;
revoke all on public.flags from anon, authenticated;
revoke all on public.found_item_private from anon, authenticated;
revoke all on public.found_items from anon, authenticated;
revoke all on public.locations from anon, authenticated;
revoke all on public.lost_report_private from anon, authenticated;
revoke all on public.lost_reports from anon, authenticated;
revoke all on public.match_suggestions from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
revoke all on public.office_settings from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.proof_questions from anon, authenticated;
revoke all on public.status_history from anon, authenticated;
revoke all on public.status_transitions from anon, authenticated;
grant delete, insert, select, update on public.categories to authenticated;
grant delete, insert, select, update on public.locations to authenticated;
grant delete, insert, select, update on public.proof_questions to authenticated;
grant insert (archived) on public.categories to authenticated;
grant insert (archived) on public.locations to authenticated;
grant insert (found_item_id, private_details, storage_location) on public.found_item_private to authenticated;
grant insert (lost_report_id, private_details) on public.lost_report_private to authenticated;
grant insert (reporter_id, title, description, category_id, location_id, date_lost, photo_paths) on public.lost_reports to authenticated;
grant insert (target_type, target_id, reason, note) on public.flags to authenticated;
grant insert (title, description, category_id, location_id, date_found, photo_paths, location_detail) on public.found_items to authenticated;
grant select on public.admin_activity to authenticated;
grant select on public.claim_answers to authenticated;
grant select on public.claim_messages to authenticated;
grant select on public.claim_threads to authenticated;
grant select on public.claims to authenticated;
grant select on public.flags to authenticated;
grant select on public.found_item_private to authenticated;
grant select on public.found_items to authenticated;
grant select on public.lost_report_private to authenticated;
grant select on public.lost_reports to authenticated;
grant select on public.match_suggestions to authenticated;
grant select on public.notifications to authenticated;
grant select on public.office_settings to anon;
grant select on public.office_settings to authenticated;
grant select on public.profiles to authenticated;
grant select on public.status_history to authenticated;
grant update (archived) on public.categories to authenticated;
grant update (archived) on public.locations to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant update (office_name, pickup_days, report_expiry_days, holding_days) on public.office_settings to authenticated;
grant update (private_details) on public.lost_report_private to authenticated;
grant update (private_details, storage_location) on public.found_item_private to authenticated;
grant update (title, description, category_id, location_id, date_found, photo_paths, location_detail, hold_until) on public.found_items to authenticated;
grant update (title, description, category_id, location_id, date_lost, photo_paths) on public.lost_reports to authenticated;

-- Sequence permissions
revoke all on sequence public.admin_activity_id_seq from anon, authenticated;
revoke all on sequence public.ai_jobs_id_seq from anon, authenticated;
revoke all on sequence public.categories_id_seq from anon, authenticated;
revoke all on sequence public.claim_answers_id_seq from anon, authenticated;
revoke all on sequence public.claim_messages_id_seq from anon, authenticated;
revoke all on sequence public.claims_ref_seq from anon, authenticated;
revoke all on sequence public.flags_id_seq from anon, authenticated;
revoke all on sequence public.found_items_ref_seq from anon, authenticated;
revoke all on sequence public.locations_id_seq from anon, authenticated;
revoke all on sequence public.lost_reports_ref_seq from anon, authenticated;
revoke all on sequence public.notifications_id_seq from anon, authenticated;
revoke all on sequence public.proof_questions_id_seq from anon, authenticated;
revoke all on sequence public.status_history_id_seq from anon, authenticated;
grant select, update, usage on sequence public.admin_activity_id_seq to anon;
grant select, update, usage on sequence public.admin_activity_id_seq to authenticated;
grant usage on sequence public.found_items_ref_seq to authenticated;
grant usage on sequence public.lost_reports_ref_seq to authenticated;

-- Function permissions
revoke execute on function private.activity_claims() from public, anon, authenticated;
revoke execute on function private.activity_found_items() from public, anon, authenticated;
revoke execute on function private.activity_lost_reports() from public, anon, authenticated;
revoke execute on function private.activity_places() from public, anon, authenticated;
revoke execute on function private.activity_profiles() from public, anon, authenticated;
revoke execute on function private.add_business_days(p_from timestamp with time zone, p_days integer) from public, anon, authenticated;
revoke execute on function private.attribute_overlap(a jsonb, b jsonb) from public, anon, authenticated;
revoke execute on function private.enforce_status_transition() from public, anon, authenticated;
revoke execute on function private.enqueue_extraction() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.log_activity(p_kind text, p_text text, p_subject text, p_href text) from public, anon, authenticated;
revoke execute on function private.log_initial_status() from public, anon, authenticated;
revoke execute on function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text) from public, anon, authenticated;
revoke execute on function private.notify_admins(p_type text, p_title text, p_body text, p_link text) from public, anon, authenticated;
revoke execute on function private.on_flag_created() from public, anon, authenticated;
revoke execute on function private.on_lost_report_edited() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.settings() from public, anon, authenticated;
revoke execute on function public.admin_decide_claim(p_claim_id uuid, p_decision text, p_reason text, p_pickup_office text, p_pickup_at timestamp with time zone) from public, anon, authenticated;
revoke execute on function public.admin_dispose_item(p_id uuid, p_method text, p_note text) from public, anon, authenticated;
revoke execute on function public.admin_return_to_custody(p_claim_id uuid) from public, anon, authenticated;
revoke execute on function public.admin_set_active(p_user uuid, p_active boolean) from public, anon, authenticated;
revoke execute on function public.admin_set_found_status(p_id uuid, p_new found_status) from public, anon, authenticated;
revoke execute on function public.admin_set_hidden(p_entity text, p_id uuid, p_hidden boolean, p_reason text) from public, anon, authenticated;
revoke execute on function public.admin_set_role(p_user uuid, p_role user_role) from public, anon, authenticated;
revoke execute on function public.candidate_matches(p_kind text, p_id uuid, p_limit integer, p_window_days integer) from public, anon, authenticated;
revoke execute on function public.complete_handover(p_claim_id uuid) from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_super_admin() from public, anon, authenticated;
revoke execute on function public.purge_old_records(p_days integer) from public, anon, authenticated;
revoke execute on function public.run_expiry_sweep() from public, anon, authenticated;
revoke execute on function public.run_pickup_expiry_sweep() from public, anon, authenticated;
revoke execute on function public.run_reminders() from public, anon, authenticated;
revoke execute on function public.send_message(p_claim_id uuid, p_body text) from public, anon, authenticated;
revoke execute on function public.set_lost_report_status(p_id uuid, p_new lost_status) from public, anon, authenticated;
revoke execute on function public.submit_claim(p_found_item_id uuid, p_lost_report_id uuid, p_answers jsonb) from public, anon, authenticated;
revoke execute on function public.withdraw_claim(p_claim_id uuid) from public, anon, authenticated;
grant execute on function private.add_business_days(p_from timestamp with time zone, p_days integer) to public;
grant execute on function private.attribute_overlap(a jsonb, b jsonb) to public;
grant execute on function private.enforce_status_transition() to public;
grant execute on function private.enqueue_extraction() to public;
grant execute on function private.handle_new_user() to public;
grant execute on function private.log_initial_status() to public;
grant execute on function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text) to public;
grant execute on function private.notify_admins(p_type text, p_title text, p_body text, p_link text) to public;
grant execute on function private.set_updated_at() to public;
grant execute on function public.admin_decide_claim(p_claim_id uuid, p_decision text, p_reason text, p_pickup_office text, p_pickup_at timestamp with time zone) to authenticated;
grant execute on function public.admin_dispose_item(p_id uuid, p_method text, p_note text) to authenticated;
grant execute on function public.admin_return_to_custody(p_claim_id uuid) to authenticated;
grant execute on function public.admin_set_active(p_user uuid, p_active boolean) to authenticated;
grant execute on function public.admin_set_found_status(p_id uuid, p_new found_status) to authenticated;
grant execute on function public.admin_set_hidden(p_entity text, p_id uuid, p_hidden boolean, p_reason text) to authenticated;
grant execute on function public.admin_set_role(p_user uuid, p_role user_role) to authenticated;
grant execute on function public.complete_handover(p_claim_id uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.send_message(p_claim_id uuid, p_body text) to authenticated;
grant execute on function public.set_lost_report_status(p_id uuid, p_new lost_status) to authenticated;
grant execute on function public.submit_claim(p_found_item_id uuid, p_lost_report_id uuid, p_answers jsonb) to authenticated;
grant execute on function public.withdraw_claim(p_claim_id uuid) to authenticated;
