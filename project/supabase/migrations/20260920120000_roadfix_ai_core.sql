/*
  RoadFix AI core schema (additive; the legacy `reports` / `upvotes` tables are left untouched).

  Security model
  - Real accounts (Supabase Auth) with a `profiles.role` of citizen | authority | admin.
  - Nobody can UPDATE or DELETE `issues` directly. All state changes go through SECURITY DEFINER
    functions (rf_confirm, rf_set_status, rf_add_note) that check the caller's role and the allowed
    status transitions, then write status_history and notifications.
  - Citizens may INSERT their own issues only, in an initial state. A trigger rate-limits to 10 per 24 h.
  - Roles cannot be self-assigned: only admins can call rf_admin_set_role.
*/

create sequence if not exists public.issue_code_seq start 1001;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Citizen',
  role text not null default 'citizen' check (role in ('citizen', 'authority', 'admin')),
  department text,
  created_at timestamptz not null default now()
);

create or replace function public.rf_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.rf_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.rf_role() in ('authority', 'admin');
$$;

create or replace function public.rf_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1), 'Citizen'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists rf_on_auth_user_created on auth.users;
create trigger rf_on_auth_user_created after insert on auth.users
  for each row execute function public.rf_handle_new_user();

-- ------------------------------------------------------------- departments
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
insert into public.departments (name) values
  ('Roads & Infrastructure'), ('Drainage & Storm Water'), ('Street Lighting'), ('Parks & Tree Cell'),
  ('Solid Waste Management'), ('Traffic Engineering'), ('Water & Sewerage')
on conflict (name) do nothing;

-- ------------------------------------------------------------------ issues
create table if not exists public.issues (
  id text primary key default ('RF-' || nextval('public.issue_code_seq')::text),
  category text not null check (category in ('pothole','road_crack','waterlogging','streetlight','fallen_tree','debris','damaged_sign','open_manhole','obstruction','other')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null default 'reported' check (status in ('reported','ai_analyzed','verified','assigned','acknowledged','work_started','resolved','citizen_verified','reopened')),
  title text not null check (char_length(title) between 3 and 200),
  description text not null check (char_length(description) between 5 and 2000),
  grievance text check (grievance is null or char_length(grievance) <= 6000),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text not null default '',
  road_name text not null default 'Unnamed road',
  area text not null default 'Unknown area',
  reporter_id uuid not null references auth.users(id),
  supporters integer not null default 1 check (supporters >= 1),
  photo_url text,
  image_hash text,
  ai_analysis jsonb,
  facilities jsonb,               -- null means "no reliable facility data was available"
  department text,
  assigned_at timestamptz,
  work_started_at timestamptz,
  resolved_at timestamptz,
  citizen_verified_at timestamptz,
  last_verified_at timestamptz,
  needs_evidence boolean not null default false,
  resolution jsonb,               -- { afterPhotoUrl, comparison, fixedVotes, stillExistsVotes }
  external_refs jsonb not null default '[]'::jsonb,  -- reference numbers from complaints filed on government portals
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_issues_status on public.issues (status);
create index if not exists idx_issues_category on public.issues (category);
create index if not exists idx_issues_created on public.issues (created_at desc);
create index if not exists idx_issues_geo on public.issues (latitude, longitude);
create index if not exists idx_issues_reporter on public.issues (reporter_id);

create table if not exists public.issue_notes (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.issues(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_name text not null,
  kind text not null default 'note' check (kind in ('note', 'evidence_request')),
  text text not null check (char_length(text) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists idx_notes_issue on public.issue_notes (issue_id);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.issues(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_name text not null default 'System',
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_history_issue on public.status_history (issue_id, created_at);

create table if not exists public.confirmations (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.issues(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('confirm', 'still_exists', 'fixed', 'add_evidence')),
  photo_url text,
  comparison jsonb,
  created_at timestamptz not null default now(),
  unique (issue_id, user_id, kind)   -- anti-abuse: one of each kind per citizen per issue
);
create index if not exists idx_conf_issue on public.confirmations (issue_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_id text references public.issues(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications (user_id, created_at desc);

-- ----------------------------------------------------- notification helpers
create or replace function public.rf_notify_user(p_user uuid, p_issue text, p_type text, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, issue_id, type, title, body) values (p_user, p_issue, p_type, p_title, p_body);
$$;

create or replace function public.rf_notify_followers(p_issue text, p_type text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select reporter_id as uid from public.issues where id = p_issue
    union
    select user_id from public.confirmations where issue_id = p_issue and kind in ('confirm', 'add_evidence', 'still_exists')
  loop
    perform public.rf_notify_user(r.uid, p_issue, p_type, p_title, p_body);
  end loop;
end $$;

create or replace function public.rf_notify_staff(p_issue text, p_type text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.profiles where role in ('authority', 'admin') loop
    perform public.rf_notify_user(r.id, p_issue, p_type, p_title, p_body);
  end loop;
end $$;

-- ----------------------------------------------------------- insert triggers
create or replace function public.rf_issue_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.issues where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limit: too many reports in 24 hours' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists rf_issue_before_insert on public.issues;
create trigger rf_issue_before_insert before insert on public.issues
  for each row execute function public.rf_issue_before_insert();

create or replace function public.rf_issue_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.status_history (issue_id, from_status, to_status, actor_name)
  values (new.id, null, 'reported', coalesce((select display_name from public.profiles where id = new.reporter_id), 'Citizen'));
  if new.status = 'ai_analyzed' then
    insert into public.status_history (issue_id, from_status, to_status, actor_name) values (new.id, 'reported', 'ai_analyzed', 'RoadFix analyzer');
  end if;
  perform public.rf_notify_user(new.reporter_id, new.id, 'report_submitted', 'Report submitted', new.id || ' was received.');
  if new.severity = 'high' then
    perform public.rf_notify_staff(new.id, 'new_high_priority', 'New high-priority issue', new.id || ' was reported with high severity.');
  end if;
  return new;
end $$;

drop trigger if exists rf_issue_after_insert on public.issues;
create trigger rf_issue_after_insert after insert on public.issues
  for each row execute function public.rf_issue_after_insert();

create or replace function public.rf_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists rf_issues_touch on public.issues;
create trigger rf_issues_touch before update on public.issues for each row execute function public.rf_touch_updated_at();

-- ------------------------------------------------------------- RPC: confirm
create or replace function public.rf_confirm(p_issue text, p_kind text, p_photo_url text default null, p_comparison jsonb default null)
returns public.issues
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  iss public.issues;
  is_reporter boolean;
  is_supporter boolean;
  votes int;
  has_evidence boolean;
  res jsonb;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_kind not in ('confirm', 'still_exists', 'fixed', 'add_evidence') then raise exception 'invalid kind'; end if;
  select * into iss from public.issues where id = p_issue for update;
  if not found then raise exception 'issue not found'; end if;

  is_reporter := iss.reporter_id = me;
  is_supporter := is_reporter or exists (
    select 1 from public.confirmations where issue_id = p_issue and user_id = me and kind in ('confirm', 'add_evidence', 'still_exists')
  );

  if p_kind = 'confirm' then
    if iss.status in ('resolved', 'citizen_verified') then raise exception 'This issue is already marked resolved.'; end if;
    if is_supporter then raise exception 'You already support this issue.'; end if;
    update public.issues set supporters = supporters + 1, last_verified_at = now() where id = p_issue;

  elsif p_kind = 'still_exists' then
    if exists (select 1 from public.confirmations where issue_id = p_issue and user_id = me and kind = 'still_exists') then
      raise exception 'You already told us this.';
    end if;
    if not is_supporter then update public.issues set supporters = supporters + 1 where id = p_issue; end if;
    update public.issues set last_verified_at = now() where id = p_issue;
    if iss.status in ('resolved', 'citizen_verified') then
      res := coalesce(iss.resolution, '{}'::jsonb) || jsonb_build_object('fixedVotes', 0, 'stillExistsVotes', coalesce((iss.resolution->>'stillExistsVotes')::int, 0) + 1);
      update public.issues set status = 'reopened', resolution = res where id = p_issue;
      insert into public.status_history (issue_id, from_status, to_status, actor_name, note)
      values (p_issue, iss.status, 'reopened', (select display_name from public.profiles where id = me), 'Citizen reports the problem still exists');
      perform public.rf_notify_staff(p_issue, 'still_unresolved', 'Citizen reports issue still unresolved', p_issue || ' was marked resolved, but a citizen says the problem still exists.');
    end if;

  elsif p_kind = 'fixed' then
    if iss.status <> 'resolved' then raise exception 'Repair verification opens once an authority marks the issue resolved.'; end if;
    if not is_supporter then raise exception 'Only citizens who reported or confirmed this issue can verify the repair.'; end if;
    if exists (select 1 from public.confirmations where issue_id = p_issue and user_id = me and kind = 'fixed') then
      raise exception 'You already verified this repair.';
    end if;
    votes := coalesce((iss.resolution->>'fixedVotes')::int, 0) + 1;
    has_evidence := p_photo_url is not null or (iss.resolution->>'afterPhotoUrl') is not null;
    res := coalesce(iss.resolution, '{}'::jsonb)
      || jsonb_build_object('fixedVotes', votes)
      || case when p_photo_url is not null then jsonb_build_object('afterPhotoUrl', p_photo_url) else '{}'::jsonb end
      || case when p_comparison is not null then jsonb_build_object('comparison', p_comparison) else '{}'::jsonb end;
    update public.issues set resolution = res where id = p_issue;
    if votes >= 2 or (votes >= 1 and has_evidence) then
      update public.issues set status = 'citizen_verified', citizen_verified_at = now() where id = p_issue;
      insert into public.status_history (issue_id, from_status, to_status, actor_name, note)
      values (p_issue, 'resolved', 'citizen_verified', (select display_name from public.profiles where id = me), 'Verified by ' || votes || ' citizen(s)');
    end if;

  elsif p_kind = 'add_evidence' then
    if p_photo_url is null then raise exception 'Attach a photo to add evidence.'; end if;
    if not is_supporter then update public.issues set supporters = supporters + 1 where id = p_issue; end if;
    update public.issues set needs_evidence = false, last_verified_at = now() where id = p_issue;
  end if;

  insert into public.confirmations (issue_id, user_id, kind, photo_url, comparison) values (p_issue, me, p_kind, p_photo_url, p_comparison);
  select * into iss from public.issues where id = p_issue;
  if iss.supporters in (5, 10, 20) and p_kind in ('confirm', 'add_evidence') then
    perform public.rf_notify_staff(p_issue, 'multiple_reports', 'Multiple reports for one location', p_issue || ' now has ' || iss.supporters || ' supporting reports.');
  end if;
  return iss;
end $$;

-- -------------------------------------------------------- RPC: staff status
create or replace function public.rf_set_status(p_issue text, p_to text, p_department text default null, p_note text default null)
returns public.issues
language plpgsql security definer set search_path = public as $$
declare
  iss public.issues;
  allowed text[];
  actor text;
begin
  if not public.rf_is_staff() then raise exception 'forbidden: only authority staff can change an incident' using errcode = '42501'; end if;
  select * into iss from public.issues where id = p_issue for update;
  if not found then raise exception 'issue not found'; end if;

  allowed := case iss.status
    when 'reported' then array['verified', 'assigned']
    when 'ai_analyzed' then array['verified', 'assigned']
    when 'verified' then array['assigned']
    when 'assigned' then array['assigned', 'acknowledged', 'work_started']
    when 'acknowledged' then array['work_started']
    when 'work_started' then array['resolved']
    when 'reopened' then array['assigned', 'work_started']
    else array[]::text[] end;
  if not (p_to = any (allowed)) then raise exception 'An issue that is % cannot move to %', iss.status, p_to; end if;
  if p_to = 'assigned' and coalesce(p_department, '') = '' then raise exception 'Choose a department to assign.'; end if;

  select display_name into actor from public.profiles where id = auth.uid();

  update public.issues set
    status = p_to,
    department = case when p_to = 'assigned' then p_department else department end,
    assigned_at = case when p_to = 'assigned' then now() else assigned_at end,
    work_started_at = case when p_to = 'work_started' then now() else work_started_at end,
    resolved_at = case when p_to = 'resolved' then now() else resolved_at end,
    last_verified_at = case when p_to in ('verified', 'assigned') and last_verified_at is null then now() else last_verified_at end,
    resolution = case when p_to = 'resolved' then jsonb_build_object('afterPhotoUrl', null, 'comparison', null, 'fixedVotes', 0, 'stillExistsVotes', 0) else resolution end
  where id = p_issue;

  insert into public.status_history (issue_id, from_status, to_status, actor_name, note)
  values (p_issue, iss.status, p_to, coalesce(actor, 'Authority'), nullif(concat_ws(': ', p_department, p_note), ''));

  if p_to = 'verified' then perform public.rf_notify_followers(p_issue, 'verified', 'Report verified', p_issue || ' was verified.'); end if;
  if p_to = 'assigned' then perform public.rf_notify_followers(p_issue, 'assigned', 'Your report was assigned', p_issue || ' was assigned to ' || p_department || '.'); end if;
  if p_to = 'work_started' then perform public.rf_notify_followers(p_issue, 'work_started', 'Work has started', 'Repair work on ' || p_issue || ' has started.'); end if;
  if p_to = 'resolved' then
    perform public.rf_notify_followers(p_issue, 'resolved', 'Issue marked resolved', p_issue || ' was marked resolved by the authority.');
    perform public.rf_notify_followers(p_issue, 'verification_requested', 'Please verify the repair', 'Has ' || p_issue || ' actually been fixed? An after-repair photo helps.');
  end if;

  select * into iss from public.issues where id = p_issue;
  return iss;
end $$;

create or replace function public.rf_add_note(p_issue text, p_text text, p_kind text default 'note')
returns public.issues
language plpgsql security definer set search_path = public as $$
declare iss public.issues; actor text;
begin
  if not public.rf_is_staff() then raise exception 'forbidden: only authority staff can add notes' using errcode = '42501'; end if;
  if p_kind not in ('note', 'evidence_request') then raise exception 'invalid kind'; end if;
  select display_name into actor from public.profiles where id = auth.uid();
  insert into public.issue_notes (issue_id, author_id, author_name, kind, text) values (p_issue, auth.uid(), coalesce(actor, 'Authority'), p_kind, left(p_text, 600));
  if p_kind = 'evidence_request' then
    update public.issues set needs_evidence = true where id = p_issue;
    perform public.rf_notify_followers(p_issue, 'evidence_requested', 'More evidence requested', p_issue || ': ' || left(p_text, 120));
  end if;
  select * into iss from public.issues where id = p_issue;
  return iss;
end $$;

create or replace function public.rf_add_external_ref(p_issue text, p_authority text, p_authority_name text, p_channel text, p_reference text)
returns public.issues
language plpgsql security definer set search_path = public as $$
declare iss public.issues; actor text; involved boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into iss from public.issues where id = p_issue for update;
  if not found then raise exception 'issue not found'; end if;
  involved := public.rf_is_staff() or iss.reporter_id = auth.uid()
    or exists (select 1 from public.confirmations where issue_id = p_issue and user_id = auth.uid());
  if not involved then raise exception 'forbidden: only people who reported or confirmed this issue can add a reference' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'Enter the reference number the office gave you.'; end if;
  select display_name into actor from public.profiles where id = auth.uid();
  update public.issues set external_refs = external_refs || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text, 'authorityId', left(p_authority, 40), 'authorityName', left(p_authority_name, 120),
    'channel', left(p_channel, 60), 'reference', left(trim(p_reference), 60), 'at', now(), 'by', coalesce(actor, 'Citizen')))
  where id = p_issue;
  select * into iss from public.issues where id = p_issue;
  return iss;
end $$;

create or replace function public.rf_admin_set_role(p_user uuid, p_role text, p_department text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.rf_role() <> 'admin' then raise exception 'forbidden: admin only' using errcode = '42501'; end if;
  if p_role not in ('citizen', 'authority', 'admin') then raise exception 'invalid role'; end if;
  update public.profiles set role = p_role, department = p_department where id = p_user;
end $$;

revoke all on function public.rf_confirm(text, text, text, jsonb) from public;
revoke all on function public.rf_set_status(text, text, text, text) from public;
revoke all on function public.rf_add_note(text, text, text) from public;
revoke all on function public.rf_add_external_ref(text, text, text, text, text) from public;
revoke all on function public.rf_admin_set_role(uuid, text, text) from public;
revoke all on function public.rf_notify_user(uuid, text, text, text, text) from public;
revoke all on function public.rf_notify_followers(text, text, text, text) from public;
revoke all on function public.rf_notify_staff(text, text, text, text) from public;
grant execute on function public.rf_confirm(text, text, text, jsonb) to authenticated;
grant execute on function public.rf_set_status(text, text, text, text) to authenticated;
grant execute on function public.rf_add_note(text, text, text) to authenticated;
grant execute on function public.rf_add_external_ref(text, text, text, text, text) to authenticated;
grant execute on function public.rf_admin_set_role(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.issues enable row level security;
alter table public.issue_notes enable row level security;
alter table public.status_history enable row level security;
alter table public.confirmations enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.rf_is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;   -- role/department can never be self-edited

drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments for select to anon, authenticated using (true);
drop policy if exists departments_admin on public.departments;
create policy departments_admin on public.departments for all to authenticated using (public.rf_role() = 'admin') with check (public.rf_role() = 'admin');

drop policy if exists issues_read on public.issues;
create policy issues_read on public.issues for select to anon, authenticated using (true);
drop policy if exists issues_insert_own on public.issues;
create policy issues_insert_own on public.issues for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status in ('reported', 'ai_analyzed')
    and supporters = 1
    and department is null and resolution is null and is_demo = false
  );
-- no UPDATE / DELETE policies on issues: mutations happen only through the RPCs above.

drop policy if exists notes_read on public.issue_notes;
create policy notes_read on public.issue_notes for select to anon, authenticated using (true);
drop policy if exists history_read on public.status_history;
create policy history_read on public.status_history for select to anon, authenticated using (true);

drop policy if exists conf_read on public.confirmations;
create policy conf_read on public.confirmations for select to authenticated using (user_id = auth.uid() or public.rf_is_staff());

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roadfix-evidence', 'roadfix-evidence', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evidence_read on storage.objects;
create policy evidence_read on storage.objects for select to anon, authenticated using (bucket_id = 'roadfix-evidence');
drop policy if exists evidence_insert on storage.objects;
create policy evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'roadfix-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- realtime
do $$ begin
  alter publication supabase_realtime add table public.issues;
exception when duplicate_object or undefined_object then null; end $$;
