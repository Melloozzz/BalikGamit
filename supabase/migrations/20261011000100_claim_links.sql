-- Notification links for claims used the claim's row id (/claims/<uuid>); the app's routes use
-- the reference number (/claims/CL-1001). Bodies are otherwise unchanged.

create or replace function public.submit_claim(p_found_item_id uuid, p_lost_report_id uuid, p_answers jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid           uuid := auth.uid();
  v_found         public.found_items;
  v_claim_id      uuid;
  v_claim_ref     text;
  v_answer        jsonb;
  v_open_count    int;
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
  returning id, ref into v_claim_id, v_claim_ref;

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
                                '/admin/claims/' || v_claim_ref);
  return v_claim_id;
end $$;

create or replace function public.send_message(p_claim_id uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
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
                           null, '/claims/' || v_claim.ref);
  else
    perform private.notify_admins('new_message', 'New message on a claim',
                                  null, '/admin/claims/' || v_claim.ref);
  end if;
  return v_id;
end $$;

create or replace function public.withdraw_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
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
                                '/admin/claims/' || v_claim.ref);
end $$;

create or replace function public.complete_handover(p_claim_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
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
                         'The handover was recorded. Thank you!', '/claims/' || v_claim.ref);
end $$;
