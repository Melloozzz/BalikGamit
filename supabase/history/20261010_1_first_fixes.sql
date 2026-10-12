-- BalikGamit: database fixes for project "iveerien's Project" (tifeckfqokdktspjokqm)
-- Run in Supabase > SQL Editor. Run STEP 1 by itself first, then STEP 2.
-- Nothing here deletes data except moving one column (step 2.6).

-- =====================================================================
-- STEP 1  (run alone: a new enum value can't be used in the same run)
-- =====================================================================
alter type public.user_role add value if not exists 'super_admin';


-- =====================================================================
-- STEP 2
-- =====================================================================

-- 2.1  Sign-up: RTU emails only, and nobody chooses their own role.
--      (The domain check was commented out, and users could send role=faculty/staff.)
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if lower(new.email) not like '%@rtu.edu.ph' then
    raise exception 'Please register with your RTU email address.';
  end if;

  insert into public.profiles (id, full_name, email, role, consent_at, consent_version)
  values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    'student',
    case when meta->>'consent_version' is not null then now() end,
    meta->>'consent_version'
  );
  return new;
end $$;

-- 2.2  Super admins count as admins everywhere is_admin() is used.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin') and p.is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin' and p.is_active
  );
$$;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- 2.3  Only a super admin can change roles (any admin could promote anyone before).
create or replace function public.admin_set_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Super admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- 2.4  Super admins also receive office notifications.
create or replace function private.notify_admins(p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.role in ('admin', 'super_admin') and p.is_active;
$$;

-- 2.5  One flag per student per post (the app promises this; the database didn't enforce it).
create unique index if not exists flags_one_per_user_target
  on public.flags (flagged_by, target_type, target_id);

-- 2.6  Shelf location is admin-only. Today every signed-in student can read
--      found_items.storage_location. Move it into the admin-only table.
alter table public.found_item_private add column if not exists storage_location text;
alter table public.found_item_private alter column private_details set default '';
insert into public.found_item_private (found_item_id, storage_location)
  select id, storage_location from public.found_items where storage_location is not null
  on conflict (found_item_id) do update set storage_location = excluded.storage_location;
alter table public.found_items drop column storage_location;
grant insert (storage_location), update (storage_location) on public.found_item_private to authenticated;

-- 2.7  Lost reports expire after 90 days, matching the Terms of Use.
--      (The cron job ran the sweep with 30; the function default is 60.)
--      Change 90 here if the office decides on a different number, and update Terms to match.
select cron.schedule('balikgamit-expire-lost-reports', '0 20 * * *', 'select public.run_expiry_sweep(90);');

-- 2.8  Make YOUR account the super admin. Replace the email first.
-- update public.profiles set role = 'super_admin' where email = 'your.name@rtu.edu.ph';


-- =====================================================================
-- CHECK  (should return: super_admin in the enum, 1 cron job with 90, the new index)
-- =====================================================================
select enum_range(null::public.user_role) as roles,
       (select command from cron.job where jobname = 'balikgamit-expire-lost-reports') as expiry_job,
       (select count(*) from pg_indexes where indexname = 'flags_one_per_user_target') as flag_index;
