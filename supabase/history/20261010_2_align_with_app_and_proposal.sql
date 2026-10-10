-- =====================================================================================
-- BalikGamit: align the database with the app (main @ 6330b70) and the group proposal
-- Project: tifeckfqokdktspjokqm ("iveerien's Project")
--
-- Run the whole file once in Supabase > SQL Editor. It is written to run in one go.
-- What it changes, by section:
--    1. Roles: add super_admin; is_admin() counts it; is_super_admin()
--    2. Sign-up: RTU emails only (the check was commented out)
--    3. Office settings table (office name, pickup days, expiry days, holding days)
--    4. Reference numbers: BG-1001 (found), LR-1001 (lost), CL-1001 (claims)
--    5. Lost reports are public when active and not hidden (proposal: "public listing")
--       + private details in an owner/admin-only table, renewals, status notes
--    6. Found items: donated / disposed statuses, holding period, location detail,
--       shelf location moved to the admin-only table
--    7. Categories and locations: the app's list; extras archived, not deleted;
--       only a super admin can edit them
--    8. Flags: one per student per post, not on your own post, optional note
--    9. Admin activity log, filled by triggers
--   10. Admin and student functions (RPCs) the app calls
--   11. Scheduled jobs: functions the Worker calls; the database's own cron jobs removed
--   12. Grants for the new tables and functions
--
-- Nothing is deleted except: the "Phone" category (merged into "Electronics") and the
-- found_items.storage_location column (its values are copied to found_item_private first).
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- 1. Roles
-- -------------------------------------------------------------------------------------
alter type public.user_role add value if not exists 'super_admin';

-- role::text comparisons so this file can run in one transaction with the new enum value.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text in ('admin', 'super_admin') and p.is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text = 'super_admin' and p.is_active
  );
$$;

create or replace function private.notify_admins(p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.role::text in ('admin', 'super_admin') and p.is_active;
$$;


-- -------------------------------------------------------------------------------------
-- 2. Sign-up: RTU emails only. Users may still say they are student, faculty or staff
--    (the proposal names all three); none of these roles has extra permissions.
-- -------------------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
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
end $$;


-- -------------------------------------------------------------------------------------
-- 3. Office settings: one row. Public pages (Terms) read it, so anon can read.
-- -------------------------------------------------------------------------------------
create table if not exists public.office_settings (
  id                 boolean primary key default true check (id),
  office_name        text    not null default '[Office name, Building]',
  pickup_days        integer not null default 5  check (pickup_days between 1 and 30),
  report_expiry_days integer not null default 90 check (report_expiry_days between 7 and 365),
  holding_days       integer not null default 60 check (holding_days between 7 and 365),
  updated_at         timestamptz not null default now()
);
insert into public.office_settings (id) values (true) on conflict (id) do nothing;
alter table public.office_settings enable row level security;

drop policy if exists "settings read" on public.office_settings;
create policy "settings read" on public.office_settings
  for select to anon, authenticated using (true);
drop policy if exists "settings super admin" on public.office_settings;
create policy "settings super admin" on public.office_settings
  for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop trigger if exists trg_settings_updated on public.office_settings;
create trigger trg_settings_updated before update on public.office_settings
  for each row execute function private.set_updated_at();

create or replace function private.settings()
returns public.office_settings language sql stable security definer set search_path = '' as $$
  select * from public.office_settings where id;
$$;


-- -------------------------------------------------------------------------------------
-- 4. Reference numbers. Existing rows get numbers too.
-- -------------------------------------------------------------------------------------
create sequence if not exists public.found_items_ref_seq start 1001;
create sequence if not exists public.lost_reports_ref_seq start 1001;
create sequence if not exists public.claims_ref_seq start 1001;

alter table public.found_items  add column if not exists ref text not null default ('BG-' || nextval('public.found_items_ref_seq'));
alter table public.lost_reports add column if not exists ref text not null default ('LR-' || nextval('public.lost_reports_ref_seq'));
alter table public.claims       add column if not exists ref text not null default ('CL-' || nextval('public.claims_ref_seq'));

create unique index if not exists found_items_ref_key  on public.found_items (ref);
create unique index if not exists lost_reports_ref_key on public.lost_reports (ref);
create unique index if not exists claims_ref_key       on public.claims (ref);


-- -------------------------------------------------------------------------------------
-- 5. Lost reports
-- -------------------------------------------------------------------------------------
alter table public.lost_reports add column if not exists status_note        text;
alter table public.lost_reports add column if not exists renewed_at         timestamptz;
alter table public.lost_reports add column if not exists expiry_reminded_at timestamptz;

-- 5a. Public listing: anyone signed in sees active, visible reports. Owners and admins see
--     all of theirs. Private details are NOT in this table, so nothing private leaks.
drop policy if exists "lost read own or admin" on public.lost_reports;
drop policy if exists "lost read" on public.lost_reports;
create policy "lost read" on public.lost_reports
  for select to authenticated
  using (
    (status = 'active' and not is_hidden)
    or reporter_id = (select auth.uid())
    or (select public.is_admin())
  );

-- 5b. Owners can edit an active report even while it is hidden (the app sends it back to the
--     office for review). They still cannot unhide it: is_hidden is not in their grants.
drop policy if exists "lost update own active" on public.lost_reports;
create policy "lost update own active" on public.lost_reports
  for update to authenticated
  using (reporter_id = (select auth.uid()) and status = 'active')
  with check (reporter_id = (select auth.uid()));

-- 5c. Owner/admin-only private details.
create table if not exists public.lost_report_private (
  lost_report_id  uuid primary key references public.lost_reports (id) on delete cascade,
  private_details text not null default '' check (char_length(private_details) <= 1000),
  updated_at      timestamptz not null default now()
);
alter table public.lost_report_private enable row level security;

drop policy if exists "lost private read" on public.lost_report_private;
create policy "lost private read" on public.lost_report_private
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.lost_reports r
               where r.id = lost_report_id and r.reporter_id = (select auth.uid()))
  );
drop policy if exists "lost private write own" on public.lost_report_private;
create policy "lost private write own" on public.lost_report_private
  for insert to authenticated
  with check (exists (select 1 from public.lost_reports r
                      where r.id = lost_report_id and r.reporter_id = (select auth.uid())));
drop policy if exists "lost private update own" on public.lost_report_private;
create policy "lost private update own" on public.lost_report_private
  for update to authenticated
  using (exists (select 1 from public.lost_reports r
                 where r.id = lost_report_id and r.reporter_id = (select auth.uid())))
  with check (exists (select 1 from public.lost_reports r
                      where r.id = lost_report_id and r.reporter_id = (select auth.uid())));

drop trigger if exists trg_lost_private_updated on public.lost_report_private;
create trigger trg_lost_private_updated before update on public.lost_report_private
  for each row execute function private.set_updated_at();

-- 5d. Photos on public reports: this policy is on the storage tables, which SQL cannot
--     change in this project. Created in the dashboard instead:
--     Storage > Policies > lost-photos > "lost-photos read public listing".

-- 5e. An owner editing a hidden report: note it and tell the office to look again.
create or replace function private.on_lost_report_edited()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_hidden and not public.is_admin() then
    new.status_note := 'Edited. Waiting for the office to review it again.';
    perform private.notify_admins('report_edited', 'A hidden report was edited', new.title, '/admin/lost/' || new.ref);
  end if;
  return new;
end $$;

drop trigger if exists lost_edited_note on public.lost_reports;
create trigger lost_edited_note
  before update of title, description, category_id, location_id, date_lost, photo_paths on public.lost_reports
  for each row
  when ((old.title, old.description, old.category_id, old.location_id, old.date_lost, old.photo_paths)
        is distinct from
        (new.title, new.description, new.category_id, new.location_id, new.date_lost, new.photo_paths))
  execute function private.on_lost_report_edited();

-- 5f. Status changes: owners may resolve, close, or renew an expired report (Terms: "You may
--     renew them"). Renewing restarts the expiry count.
create or replace function public.set_lost_report_status(p_id uuid, p_new public.lost_status)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;


-- -------------------------------------------------------------------------------------
-- 6. Found items
-- -------------------------------------------------------------------------------------
alter type public.found_status add value if not exists 'donated';
alter type public.found_status add value if not exists 'disposed';

insert into public.status_transitions (entity_type, from_status, to_status) values
  ('found_item', 'in_custody', 'donated'),
  ('found_item', 'in_custody', 'disposed')
on conflict do nothing;

alter table public.found_items add column if not exists location_detail text check (char_length(location_detail) <= 200);
alter table public.found_items add column if not exists hold_until      date;
alter table public.found_items add column if not exists disposal_note   text check (char_length(disposal_note) <= 500);
alter table public.found_items add column if not exists disposed_by     uuid references public.profiles (id) on delete set null;

-- Shelf location is admin-only: move it out of the table every student can read.
alter table public.found_item_private add column if not exists storage_location text;
alter table public.found_item_private alter column private_details set default '';
do $mv$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'found_items' and column_name = 'storage_location') then
    insert into public.found_item_private (found_item_id, storage_location)
      select id, storage_location from public.found_items where storage_location is not null
      on conflict (found_item_id) do update set storage_location = excluded.storage_location;
    alter table public.found_items drop column storage_location;
  end if;
end $mv$;

-- Also purge donated and disposed items after the retention period.
create or replace function public.purge_old_records(p_days integer default 365)
returns integer language plpgsql security definer set search_path = '' as $$
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
end $$;


-- -------------------------------------------------------------------------------------
-- 7. Categories and locations: the app's list. Renamed in place so existing records keep
--    their links. Extras are archived (hidden from dropdowns, kept on old records).
-- -------------------------------------------------------------------------------------
alter table public.categories add column if not exists archived boolean not null default false;
alter table public.locations  add column if not exists archived boolean not null default false;

-- Categories
insert into public.categories (name) values ('Electronics') on conflict (name) do nothing;
do $cat$
declare
  v_old smallint := (select id from public.categories where name = 'Electronics / Gadgets');
  v_ph  smallint := (select id from public.categories where name = 'Phone');
  v_new smallint := (select id from public.categories where name = 'Electronics');
begin
  -- "Phone" and a leftover "Electronics / Gadgets" merge into "Electronics".
  update public.proof_questions set category_id = v_new where category_id in (v_old, v_ph);
  update public.lost_reports    set category_id = v_new where category_id in (v_old, v_ph);
  update public.found_items     set category_id = v_new where category_id in (v_old, v_ph);
  delete from public.categories where id in (v_old, v_ph) and id <> v_new;
end $cat$;

update public.categories set name = 'ID & Cards'            where name = 'ID / Cards';
update public.categories set name = 'Bags'                  where name = 'Bag';
update public.categories set name = 'School supplies'       where name = 'Books / Notebooks';
update public.categories set name = 'Clothing'              where name = 'Clothing / Accessories';
update public.categories set name = 'Tumblers & Containers' where name = 'Water bottle / Tumbler';
update public.categories set name = 'Others'                where name = 'Other';
insert into public.categories (name) values
  ('Bags'), ('Clothing'), ('ID & Cards'), ('Jewelry & Accessories'), ('Keys'),
  ('School supplies'), ('Tumblers & Containers'), ('Umbrella'), ('Wallet'), ('Others')
on conflict (name) do nothing;

update public.categories c set sort_order = v.o, archived = false
  from (values ('Bags', 1), ('Clothing', 2), ('Electronics', 3), ('ID & Cards', 4),
               ('Jewelry & Accessories', 5), ('Keys', 6), ('School supplies', 7),
               ('Tumblers & Containers', 8), ('Umbrella', 9), ('Wallet', 10), ('Others', 11)) v(n, o)
 where c.name = v.n;
update public.categories set archived = true, sort_order = 100
 where name not in ('Bags', 'Clothing', 'Electronics', 'ID & Cards', 'Jewelry & Accessories', 'Keys',
                    'School supplies', 'Tumblers & Containers', 'Umbrella', 'Wallet', 'Others');

-- Locations. "Room 304" is in the app's sample list; replace it with the office's real list.
update public.locations set name = 'Gym'       where name = 'Gymnasium';
update public.locations set name = 'Main gate' where name = 'Main gate / Security';
update public.locations set name = 'Other'     where name = 'Other / Not sure';
insert into public.locations (name) values
  ('MAE Building'), ('RND Building'), ('Library'), ('Canteen'), ('Gym'), ('Room 304'), ('Main gate'), ('Other')
on conflict (name) do nothing;

update public.locations l set sort_order = v.o, archived = false
  from (values ('MAE Building', 1), ('RND Building', 2), ('Library', 3), ('Canteen', 4),
               ('Gym', 5), ('Room 304', 6), ('Main gate', 7), ('Other', 8)) v(n, o)
 where l.name = v.n;
update public.locations set archived = true, sort_order = 100
 where name not in ('MAE Building', 'RND Building', 'Library', 'Canteen', 'Gym', 'Room 304', 'Main gate', 'Other');

-- Only a super admin edits the lists (app rule). Separate write policies so reads use one policy.
drop policy if exists "categories admin" on public.categories;
drop policy if exists "categories insert" on public.categories;
drop policy if exists "categories update" on public.categories;
drop policy if exists "categories delete" on public.categories;
create policy "categories insert" on public.categories for insert to authenticated with check ((select public.is_super_admin()));
create policy "categories update" on public.categories for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy "categories delete" on public.categories for delete to authenticated using ((select public.is_super_admin()));

drop policy if exists "locations admin" on public.locations;
drop policy if exists "locations insert" on public.locations;
drop policy if exists "locations update" on public.locations;
drop policy if exists "locations delete" on public.locations;
create policy "locations insert" on public.locations for insert to authenticated with check ((select public.is_super_admin()));
create policy "locations update" on public.locations for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy "locations delete" on public.locations for delete to authenticated using ((select public.is_super_admin()));

drop policy if exists "proof_questions admin" on public.proof_questions;
drop policy if exists "proof_questions insert" on public.proof_questions;
drop policy if exists "proof_questions update" on public.proof_questions;
drop policy if exists "proof_questions delete" on public.proof_questions;
create policy "proof_questions insert" on public.proof_questions for insert to authenticated with check ((select public.is_admin()));
create policy "proof_questions update" on public.proof_questions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "proof_questions delete" on public.proof_questions for delete to authenticated using ((select public.is_admin()));


-- -------------------------------------------------------------------------------------
-- 8. Flags
-- -------------------------------------------------------------------------------------
alter table public.flags add column if not exists note text check (char_length(note) <= 500);
create unique index if not exists flags_one_per_user_target on public.flags (flagged_by, target_type, target_id);

-- Only posts you can see, and never your own.
drop policy if exists "flags insert own" on public.flags;
create policy "flags insert own" on public.flags
  for insert to authenticated
  with check (
    flagged_by = (select auth.uid())
    and (
      (target_type = 'lost_report' and exists (
         select 1 from public.lost_reports r
          where r.id = target_id and r.reporter_id <> (select auth.uid())))
      or
      (target_type = 'found_item' and exists (
         select 1 from public.found_items f where f.id = target_id))
    )
  );

create or replace function private.on_flag_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  if new.target_type = 'lost_report' then
    select title into v_title from public.lost_reports where id = new.target_id;
  else
    select title into v_title from public.found_items where id = new.target_id;
  end if;
  perform private.notify_admins('flagged', 'A post was flagged', coalesce(v_title, '') || ' · ' || new.reason, '/admin/flagged');
  return new;
end $$;

drop trigger if exists flags_notify on public.flags;
create trigger flags_notify after insert on public.flags
  for each row execute function private.on_flag_created();

-- Hiding a lost report tells its owner; unhiding clears the note.
create or replace function public.admin_set_hidden(p_entity text, p_id uuid, p_hidden boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;


-- -------------------------------------------------------------------------------------
-- 9. Admin activity log (the app's Activity page). Written only by triggers, and only
--    when the person acting is an admin. Admins can read it; nobody can write it directly.
-- -------------------------------------------------------------------------------------
create table if not exists public.admin_activity (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null check (kind in ('logged', 'edited', 'approved', 'rejected', 'asked', 'released',
                                           'returned_to_custody', 'hid', 'unhid', 'donated', 'disposed',
                                           'extended', 'places', 'admins')),
  text       text not null,
  subject    text,
  href       text,
  created_at timestamptz not null default now()
);
create index if not exists admin_activity_created_idx on public.admin_activity (created_at desc);
create index if not exists admin_activity_actor_idx   on public.admin_activity (actor_id);
alter table public.admin_activity enable row level security;
drop policy if exists "activity read admin" on public.admin_activity;
create policy "activity read admin" on public.admin_activity
  for select to authenticated using ((select public.is_admin()));

create or replace function private.log_activity(p_kind text, p_text text, p_subject text, p_href text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    insert into public.admin_activity (actor_id, kind, text, subject, href)
    values (auth.uid(), p_kind, p_text, p_subject, p_href);
  end if;
end $$;

create or replace function private.activity_found_items()
returns trigger language plpgsql security definer set search_path = '' as $$
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
end $$;

drop trigger if exists found_activity on public.found_items;
create trigger found_activity after insert or update on public.found_items
  for each row execute function private.activity_found_items();

create or replace function private.activity_lost_reports()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_activity(case when new.is_hidden then 'hid' else 'unhid' end,
    case when new.is_hidden then 'hid lost report ' else 'made visible lost report ' end || new.ref,
    new.title, '/admin/lost/' || new.ref);
  return new;
end $$;

drop trigger if exists lost_activity on public.lost_reports;
create trigger lost_activity after update of is_hidden on public.lost_reports
  for each row when (old.is_hidden is distinct from new.is_hidden)
  execute function private.activity_lost_reports();

create or replace function private.activity_claims()
returns trigger language plpgsql security definer set search_path = '' as $$
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
end $$;

drop trigger if exists claim_activity on public.claims;
create trigger claim_activity after update of status on public.claims
  for each row when (old.status is distinct from new.status)
  execute function private.activity_claims();

create or replace function private.activity_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    perform private.log_activity('admins', 'changed ' || new.full_name || '''s role to ' || replace(new.role::text, '_', ' '), null, null);
  end if;
  if new.is_active is distinct from old.is_active then
    perform private.log_activity('admins', case when new.is_active then 'reactivated ' else 'deactivated ' end || new.full_name || '''s account', null, null);
  end if;
  return new;
end $$;

drop trigger if exists profile_activity on public.profiles;
create trigger profile_activity after update of role, is_active on public.profiles
  for each row execute function private.activity_profiles();

create or replace function private.activity_places()
returns trigger language plpgsql security definer set search_path = '' as $$
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
end $$;

drop trigger if exists categories_activity on public.categories;
create trigger categories_activity after insert or update or delete on public.categories
  for each row execute function private.activity_places();
drop trigger if exists locations_activity on public.locations;
create trigger locations_activity after insert or update or delete on public.locations
  for each row execute function private.activity_places();


-- -------------------------------------------------------------------------------------
-- 10. Functions the app calls
-- -------------------------------------------------------------------------------------

-- 10a. Approve / reject: pickup days and office name now come from office_settings.
create or replace function public.admin_decide_claim(
  p_claim_id uuid, p_decision text, p_reason text default null,
  p_pickup_office text default null, p_pickup_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;

-- 10b. The claimant did not show up: claim expires, item goes back on the shelf.
create or replace function public.admin_return_to_custody(p_claim_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;

-- 10c. Donate or dispose of an unclaimed item after its holding period.
create or replace function public.admin_dispose_item(p_id uuid, p_method text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;

-- 10d. Super admin: deactivate or reactivate an account.
create or replace function public.admin_set_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Super admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot deactivate your own account'; end if;
  update public.profiles set is_active = p_active where id = p_user;
end $$;

-- 10e. Super admin only can change roles (before, any admin could make anyone an admin).
create or replace function public.admin_set_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Super admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;


-- -------------------------------------------------------------------------------------
-- 11. Scheduled jobs. The proposal puts these on the Cloudflare Cron Trigger, so the
--     Worker calls these functions (with the service key) and the database's own cron
--     jobs are removed. One scheduler, one place for the numbers (office_settings).
-- -------------------------------------------------------------------------------------
do $cron$
begin
  perform cron.unschedule(jobid) from cron.job
   where jobname in ('balikgamit-expire-lost-reports', 'balikgamit-expire-pickups', 'balikgamit-purge-old-records');
end $cron$;

drop function if exists public.run_expiry_sweep(integer);
create function public.run_expiry_sweep()
returns integer language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function public.run_pickup_expiry_sweep()
returns integer language plpgsql security definer set search_path = '' as $$
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
end $$;

-- Reminders (proposal: "reminders"): a lost report 7 days before it expires, and a pickup
-- due within a day. Each is sent once.
alter table public.claims add column if not exists pickup_reminded_at timestamptz;

create or replace function public.run_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
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
end $$;


-- -------------------------------------------------------------------------------------
-- 12. Grants. Supabase gives new tables and functions to everyone by default, so each one
--     is locked down first, then opened only as far as the app needs.
-- -------------------------------------------------------------------------------------

-- New tables
revoke all on public.office_settings, public.lost_report_private, public.admin_activity from anon, authenticated;
grant select on public.office_settings to anon, authenticated;
grant update (office_name, pickup_days, report_expiry_days, holding_days) on public.office_settings to authenticated;
grant select on public.lost_report_private to authenticated;
grant insert (lost_report_id, private_details), update (private_details) on public.lost_report_private to authenticated;
grant select on public.admin_activity to authenticated;

-- New sequences: signed-in users need USAGE so the ref default works when they insert
-- (students add lost reports, admins log found items). Claims are inserted by submit_claim.
revoke all on sequence public.found_items_ref_seq, public.lost_reports_ref_seq, public.claims_ref_seq from anon, authenticated;
grant usage on sequence public.found_items_ref_seq, public.lost_reports_ref_seq to authenticated;

-- New columns the browser may write (row-level policies still decide whose rows)
grant insert (location_detail), update (location_detail, hold_until) on public.found_items to authenticated;
grant insert (storage_location), update (storage_location) on public.found_item_private to authenticated;
grant insert (note) on public.flags to authenticated;
grant insert (archived), update (archived) on public.categories to authenticated;
grant insert (archived), update (archived) on public.locations to authenticated;

-- Functions the browser calls
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.admin_return_to_custody(uuid) from public, anon;
revoke execute on function public.admin_dispose_item(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_active(uuid, boolean) from public, anon;
grant execute on function public.is_super_admin(), public.admin_return_to_custody(uuid),
  public.admin_dispose_item(uuid, text, text), public.admin_set_active(uuid, boolean) to authenticated;

-- Functions only the Worker (service key) calls
revoke execute on function public.run_expiry_sweep(), public.run_pickup_expiry_sweep(),
  public.run_reminders(), public.purge_old_records(integer) from public, anon, authenticated;

-- Internal helpers are never called from the API
revoke execute on function private.settings(), private.log_activity(text, text, text, text),
  private.on_lost_report_edited(), private.on_flag_created(), private.activity_found_items(),
  private.activity_lost_reports(), private.activity_claims(), private.activity_profiles(),
  private.activity_places() from public, anon, authenticated;
