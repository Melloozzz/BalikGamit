-- Status-rule test (proposal: "illegal status transitions are rejected by the database").
--
-- Tries EVERY possible status change on claims, found items and lost reports, directly with
-- UPDATE (bypassing the app and the RPCs), and checks that exactly the allowed ones go through.
-- The allowed list is written out here from the app and the paper, so an accidental change to
-- public.status_transitions also fails this test. Then checks a signed-in student can't change
-- a status or post as someone else at all.
--
-- Run it in the Supabase SQL Editor (or psql). It changes nothing: it always ends with an error
-- whose message is the result, which rolls everything back.
--   PASS → "RESULT: PASS ..."      FAIL → "RESULT: FAIL ..." followed by what went wrong.

do $test$
declare
  allowed constant text[] := array[
    'claim:pending>needs_info', 'claim:pending>approved', 'claim:pending>rejected', 'claim:pending>withdrawn',
    'claim:needs_info>pending', 'claim:needs_info>approved', 'claim:needs_info>rejected', 'claim:needs_info>withdrawn',
    'claim:approved>completed', 'claim:approved>expired', 'claim:approved>withdrawn',
    'found_item:in_custody>claim_pending', 'found_item:in_custody>donated', 'found_item:in_custody>disposed',
    'found_item:claim_pending>in_custody', 'found_item:claim_pending>ready_for_pickup',
    'found_item:ready_for_pickup>returned', 'found_item:ready_for_pickup>in_custody',
    'lost_report:active>resolved', 'lost_report:active>closed', 'lost_report:active>expired',
    'lost_report:expired>active'
  ];
  v_user    uuid;
  v_other   uuid;
  v_cat     smallint;
  v_item    uuid;
  v_row     uuid;
  f text; t text; key text;
  went_through boolean;
  checked   int := 0;
  failures  text[] := '{}';
  in_table  text[];
begin
  select id into v_user from public.profiles where role::text not in ('admin', 'super_admin') order by created_at limit 1;
  select id into v_other from public.profiles where id <> v_user order by created_at limit 1;
  select id into v_cat from public.categories order by id limit 1;
  if v_user is null or v_other is null or v_cat is null then
    raise exception 'RESULT: SKIPPED — needs at least one student profile, one other profile and one category';
  end if;

  -- 0. The table the trigger reads matches the list above.
  select array_agg(x order by x) into in_table
  from (select entity_type || ':' || from_status || '>' || to_status as x from public.status_transitions) s;
  if (select array_agg(x order by x) from unnest(allowed) x) is distinct from in_table then
    failures := failures || ('status_transitions differs from the expected list: ' || array_to_string(in_table, ', '));
  end if;

  -- 1. Claims: every from → to pair.
  foreach f in array enum_range(null::public.claim_status)::text[] loop
    foreach t in array enum_range(null::public.claim_status)::text[] loop
      continue when f = t;
      insert into public.found_items (title, description, category_id)
      values ('Status test item', 'Created by the status-rule test.', v_cat) returning id into v_item;
      insert into public.claims (found_item_id, claimant_id, status)
      values (v_item, v_user, f::public.claim_status) returning id into v_row;
      begin
        update public.claims set status = t::public.claim_status where id = v_row;
        went_through := true;
      exception when others then
        went_through := false;
      end;
      key := 'claim:' || f || '>' || t;
      checked := checked + 1;
      if went_through <> (key = any(allowed)) then
        failures := failures || (key || case when went_through then ' was allowed' else ' was blocked' end);
      end if;
    end loop;
  end loop;

  -- 2. Found items.
  foreach f in array enum_range(null::public.found_status)::text[] loop
    foreach t in array enum_range(null::public.found_status)::text[] loop
      continue when f = t;
      insert into public.found_items (title, description, category_id, status)
      values ('Status test item', 'Created by the status-rule test.', v_cat, f::public.found_status) returning id into v_row;
      begin
        update public.found_items set status = t::public.found_status where id = v_row;
        went_through := true;
      exception when others then
        went_through := false;
      end;
      key := 'found_item:' || f || '>' || t;
      checked := checked + 1;
      if went_through <> (key = any(allowed)) then
        failures := failures || (key || case when went_through then ' was allowed' else ' was blocked' end);
      end if;
    end loop;
  end loop;

  -- 3. Lost reports.
  foreach f in array enum_range(null::public.lost_status)::text[] loop
    foreach t in array enum_range(null::public.lost_status)::text[] loop
      continue when f = t;
      insert into public.lost_reports (reporter_id, title, description, category_id, date_lost, status)
      values (v_user, 'Status test report', 'Created by the status-rule test.', v_cat, current_date, f::public.lost_status) returning id into v_row;
      begin
        update public.lost_reports set status = t::public.lost_status where id = v_row;
        went_through := true;
      exception when others then
        went_through := false;
      end;
      key := 'lost_report:' || f || '>' || t;
      checked := checked + 1;
      if went_through <> (key = any(allowed)) then
        failures := failures || (key || case when went_through then ' was allowed' else ' was blocked' end);
      end if;
    end loop;
  end loop;

  -- 4. A signed-in student can't skip the database functions.
  insert into public.lost_reports (reporter_id, title, description, category_id, date_lost)
  values (v_user, 'Status test report', 'Created by the status-rule test.', v_cat, current_date) returning id into v_row;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    update public.lost_reports set status = 'resolved' where id = v_row;
    failures := failures || 'a student changed their report''s status with a plain UPDATE'::text;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.lost_reports set is_hidden = false where id = v_row;
    failures := failures || 'a student changed is_hidden with a plain UPDATE'::text;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.lost_reports (reporter_id, title, description, category_id, date_lost)
    values (v_other, 'Posing as someone', 'Created by the status-rule test.', v_cat, current_date);
    failures := failures || 'a student posted a lost report under another account'::text;
  exception when insufficient_privilege or check_violation then null;
  end;

  -- The legitimate path still works: the owner closes their own report through the function.
  begin
    perform public.set_lost_report_status(v_row, 'resolved');
  exception when others then
    failures := failures || ('set_lost_report_status failed for the owner: ' || sqlerrm);
  end;

  reset role;

  if cardinality(failures) = 0 then
    raise exception 'RESULT: PASS — % status changes checked (% allowed, % rejected); student bypasses blocked',
      checked, cardinality(allowed), checked - cardinality(allowed);
  end if;
  raise exception 'RESULT: FAIL — %', array_to_string(failures, '; ');
end
$test$;
