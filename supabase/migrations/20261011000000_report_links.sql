-- Notification links for lost reports pointed at /my-reports/<ref>, which the app doesn't have.
-- Students see their reports at /reports. Bodies are otherwise unchanged from the Oct 10 migration.

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
                             coalesce(p_reason, 'It did not follow the posting rules.'), '/reports');
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

create or replace function public.run_expiry_sweep()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n      int;
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
  select reporter_id, 'report_expired', 'Your lost report has expired', title, '/reports'
  from expired;
  get diagnostics n = row_count;
  return n;
end $$;

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
         title || ' · Renew it if you are still looking.', '/reports'
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
