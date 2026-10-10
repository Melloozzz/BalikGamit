-- BalikGamit starting data. Run after migrations/20261010000000_baseline.sql on a new project.
-- Reference data only: no users, reports, claims or other personal data.

-- Office settings (one row). Replace the office name once the office confirms it.
insert into public.office_settings (id, office_name, pickup_days, report_expiry_days, holding_days)
values (true, '[Office name, Building]', 5, 90, 60)
on conflict (id) do nothing;

-- Categories (the app's list)
insert into public.categories (name, sort_order, archived) values
  ('Bags', 1, false),
  ('Clothing', 2, false),
  ('Electronics', 3, false),
  ('ID & Cards', 4, false),
  ('Jewelry & Accessories', 5, false),
  ('Keys', 6, false),
  ('School supplies', 7, false),
  ('Tumblers & Containers', 8, false),
  ('Umbrella', 9, false),
  ('Wallet', 10, false),
  ('Others', 11, false)
on conflict (name) do nothing;

-- Locations. "Room 304" comes from the app's sample list: replace with the office's real building list.
insert into public.locations (name, sort_order, archived) values
  ('MAE Building', 1, false),
  ('RND Building', 2, false),
  ('Library', 3, false),
  ('Canteen', 4, false),
  ('Gym', 5, false),
  ('Room 304', 6, false),
  ('Main gate', 7, false),
  ('Other', 8, false)
on conflict (name) do nothing;

-- Proof questions. A null category means the question is asked for every item.
insert into public.proof_questions (category_id, question) values
  (null, 'Describe any marks, stickers, scratches, or damage on the item.'),
  (null, 'Where and roughly what time did you lose it?'),
  ((select id from public.categories where name = 'Electronics'), 'What is on your lock screen or wallpaper?'),
  ((select id from public.categories where name = 'Electronics'), 'What phone case does it have?'),
  ((select id from public.categories where name = 'Wallet'), 'What items are inside (without ID numbers)?'),
  ((select id from public.categories where name = 'Bags'), 'What is inside the main compartment?'),
  ((select id from public.categories where name = 'Keys'), 'How many keys, and what keychain or charm is attached?'),
  ((select id from public.categories where name = 'ID & Cards'), 'What is the last thing you remember about where you kept it?');

-- Allowed status changes. The status triggers reject anything not listed here.
insert into public.status_transitions (entity_type, from_status, to_status) values
  ('lost_report', 'active', 'resolved'),
  ('lost_report', 'active', 'closed'),
  ('lost_report', 'active', 'expired'),
  ('lost_report', 'expired', 'active'),
  ('found_item', 'in_custody', 'claim_pending'),
  ('found_item', 'in_custody', 'donated'),
  ('found_item', 'in_custody', 'disposed'),
  ('found_item', 'claim_pending', 'in_custody'),
  ('found_item', 'claim_pending', 'ready_for_pickup'),
  ('found_item', 'ready_for_pickup', 'in_custody'),
  ('found_item', 'ready_for_pickup', 'returned'),
  ('claim', 'pending', 'needs_info'),
  ('claim', 'pending', 'approved'),
  ('claim', 'pending', 'rejected'),
  ('claim', 'pending', 'withdrawn'),
  ('claim', 'needs_info', 'pending'),
  ('claim', 'needs_info', 'approved'),
  ('claim', 'needs_info', 'rejected'),
  ('claim', 'needs_info', 'withdrawn'),
  ('claim', 'approved', 'completed'),
  ('claim', 'approved', 'expired'),
  ('claim', 'approved', 'withdrawn')
on conflict do nothing;
