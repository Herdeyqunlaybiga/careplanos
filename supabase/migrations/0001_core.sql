-- CarePlanOS demo tenant backend: append-only event ledger with server-side role, identity, time and PRN checks.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  demo_epoch int not null default 1,
  epoch_started_at timestamptz not null default now(),
  clock_offset_ms bigint not null default 0,
  active_staff text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('worker', 'manager')),
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  epoch int not null,
  seq int not null,
  type text not null,
  payload jsonb not null,
  actor_user uuid not null,
  actor_name text not null,
  actor_role text not null,
  created_at timestamptz not null default now(),
  prev_hash text not null,
  hash text not null,
  unique (tenant_id, epoch, seq)
);
create index events_tenant_epoch_seq on public.events (tenant_id, epoch, seq);

create table app_private.allowed_emails (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('worker', 'manager')),
  display_name text not null,
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, email)
);

create table app_private.staff_pins (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_name text not null,
  staff_role text not null,
  pin_hash text not null,
  primary key (tenant_id, staff_name)
);

create table app_private.pin_attempts (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  staff_name text not null,
  user_id uuid not null,
  ok boolean not null,
  at timestamptz not null default now()
);

create table app_private.prn_rules (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  med_id text not null,
  resident_id text not null,
  min_interval_h int not null,
  max_doses_24h int not null,
  unit_max int not null,
  para_mg int,
  weight_kg numeric not null,
  primary key (tenant_id, med_id)
);

create table app_private.prn_doses (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  epoch int not null,
  med_id text not null,
  resident_id text not null,
  sim_at bigint not null,
  units int not null,
  para_mg int
);
create index prn_doses_lookup on app_private.prn_doses (tenant_id, epoch, resident_id, sim_at);

-- Append-only ledger
create or replace function app_private.block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'events are append-only';
end $$;
create trigger events_no_update before update or delete on public.events for each row execute function app_private.block_mutation();
create trigger events_no_truncate before truncate on public.events for each statement execute function app_private.block_mutation();

-- Row level security
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;

create policy tenants_member_read on public.tenants for select to authenticated
  using (exists (select 1 from public.memberships m where m.tenant_id = tenants.id and m.user_id = (select auth.uid())));
create policy memberships_own_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy events_member_read on public.events for select to authenticated
  using (exists (select 1 from public.memberships m where m.tenant_id = events.tenant_id and m.user_id = (select auth.uid())));

revoke all on public.tenants, public.memberships, public.events from anon, authenticated;
grant select on public.tenants, public.memberships, public.events to authenticated;

-- Simulated demo clock shared by every device (scenario starts Tue 10 Nov 2026 15:42:10 UK time)
create or replace function app_private.sim_now(t public.tenants) returns bigint language sql stable as $$
  select 1794325330000::bigint + (extract(epoch from (now() - t.epoch_started_at)) * 1000)::bigint + t.clock_offset_ms;
$$;

create or replace function public.claim_membership() returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.memberships (tenant_id, user_id, role, display_name)
  select a.tenant_id, auth.uid(), a.role, a.display_name from app_private.allowed_emails a
  where lower(a.email) = v_email
  on conflict (tenant_id, user_id) do nothing;
end $$;

create or replace function public.get_my_context() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.memberships; t public.tenants;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into m from public.memberships where user_id = auth.uid() order by created_at limit 1;
  if not found then return null; end if;
  select * into t from public.tenants where id = m.tenant_id;
  return jsonb_build_object(
    'tenant_id', t.id, 'tenant_name', t.name, 'role', m.role, 'display_name', m.display_name,
    'epoch', t.demo_epoch, 'epoch_started_ms', (extract(epoch from t.epoch_started_at) * 1000)::bigint,
    'clock_offset_ms', t.clock_offset_ms, 'server_now_ms', (extract(epoch from now()) * 1000)::bigint,
    'active_staff', t.active_staff);
end $$;

create or replace function public.submit_event(p_type text, p_payload jsonb, p_epoch int) returns public.events
language plpgsql security definer set search_path = '' as $$
declare
  m public.memberships; t public.tenants; r app_private.prn_rules; ev public.events;
  v_sim bigint; v_payload jsonb := p_payload; v_prev text; v_seq int; v_actor text;
  v_units int; v_last bigint; v_cnt int; v_plast bigint; v_pmg int; v_limit numeric; v_pin record; v_fails int;
  v_time text; v_t bigint;
  worker_types text[] := array['ADD_LOG','REPLY_CLARIFICATION','ADMINISTER_MED','REFUSE_MED','PRN_BLOCKED','SCAN_MISMATCH','ADD_INCIDENT','RAISE_SOS','CANCEL_SOS','SUBMIT_REPORT','TOGGLE_CARE','SIGN_IN','LOCK'];
  manager_types text[] := array['REQUEST_CLARIFICATION','APPROVE_LOG','REJECT_LOG','TOGGLE_FLAG','REVIEW_INCIDENT','ACK_SOS','RESOLVE_SOS','SIGN_REPORT','NHS_VIEWED','PACK_EXPORTED','INTEGRITY_CHECK','ESCALATE_CLARIFICATION','REVIEW_RISK','STATUTORY_ACTION','BOOK_TRAINING','FAMILY_MESSAGE','CLOCK_ADVANCE'];
  handset_types text[] := array['ADD_LOG','REPLY_CLARIFICATION','ADMINISTER_MED','REFUSE_MED','ADD_INCIDENT','RAISE_SOS','SUBMIT_REPORT','TOGGLE_CARE'];
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into m from public.memberships where user_id = auth.uid() order by created_at limit 1;
  if not found then raise exception 'NO_ACCESS'; end if;
  select * into t from public.tenants where id = m.tenant_id for update;
  if p_epoch <> t.demo_epoch then raise exception 'STALE_EPOCH'; end if;
  if not (p_type = any(worker_types) or (m.role = 'manager' and p_type = any(manager_types))) then raise exception 'FORBIDDEN: % cannot %', m.role, p_type; end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 40000 then raise exception 'INVALID_PAYLOAD'; end if;
  if coalesce(p_payload ->> 'type', '') <> p_type then raise exception 'INVALID_PAYLOAD'; end if;

  v_sim := app_private.sim_now(t);
  foreach v_time in array array[p_payload ->> 'now', p_payload #>> '{entry,time}', p_payload #>> '{msg,time}', p_payload #>> '{sos,raisedAt}', p_payload #>> '{incident,time}', p_payload #>> '{log,time}'] loop
    if v_time is not null then
      v_t := v_time::bigint;
      if abs(v_t - v_sim) > 300000 then raise exception 'CLOCK_SKEW'; end if;
    end if;
  end loop;

  if p_type = any(handset_types) and t.active_staff is null then raise exception 'HANDSET_LOCKED'; end if;
  v_actor := coalesce(t.active_staff, m.display_name);

  if p_type = 'SIGN_IN' then
    select * into v_pin from app_private.staff_pins where tenant_id = t.id and staff_name = p_payload #>> '{actor,name}';
    if not found then raise exception 'PIN_INVALID'; end if;
    select count(*) into v_fails from app_private.pin_attempts where tenant_id = t.id and staff_name = v_pin.staff_name and not ok and at > now() - interval '10 minutes';
    if v_fails >= 5 then raise exception 'PIN_LOCKED'; end if;
    if coalesce(p_payload ->> 'pin', '') = '' or extensions.crypt(p_payload ->> 'pin', v_pin.pin_hash) <> v_pin.pin_hash then
      insert into app_private.pin_attempts (tenant_id, staff_name, user_id, ok) values (t.id, v_pin.staff_name, auth.uid(), false);
      return null;
    end if;
    insert into app_private.pin_attempts (tenant_id, staff_name, user_id, ok) values (t.id, v_pin.staff_name, auth.uid(), true);
    v_payload := (v_payload - 'pin') || jsonb_build_object('actor', jsonb_build_object('name', v_pin.staff_name, 'role', v_pin.staff_role, 'kind', 'worker'), 'method', 'badge + PIN (server verified)');
    update public.tenants set active_staff = v_pin.staff_name where id = t.id;
    v_actor := v_pin.staff_name;
  elsif p_type = 'LOCK' then
    update public.tenants set active_staff = null where id = t.id;
  elsif p_type = 'CLOCK_ADVANCE' then
    update public.tenants set clock_offset_ms = clock_offset_ms + 900000 where id = t.id;
    v_payload := jsonb_build_object('type', 'CLOCK_ADVANCE', 'ms', 900000);
  end if;

  if p_type = 'ADD_LOG' then
    v_payload := jsonb_set(jsonb_set(v_payload, '{entry,author}', to_jsonb(v_actor)), '{actor,name}', to_jsonb(v_actor));
    v_payload := jsonb_set(v_payload, '{actor,kind}', '"worker"');
  elsif p_type in ('ADMINISTER_MED', 'REFUSE_MED') then
    v_payload := jsonb_set(v_payload, '{log,author}', to_jsonb(v_actor));
  elsif p_type = 'ADD_INCIDENT' then
    v_payload := jsonb_set(jsonb_set(v_payload, '{incident,author}', to_jsonb(v_actor)), '{log,author}', to_jsonb(v_actor));
  elsif p_type = 'REPLY_CLARIFICATION' then
    v_payload := jsonb_set(v_payload, '{msg,author}', to_jsonb(v_actor));
  elsif p_type = 'RAISE_SOS' then
    v_payload := jsonb_set(v_payload, '{sos,worker}', to_jsonb(v_actor));
  elsif p_type = 'REQUEST_CLARIFICATION' then
    v_payload := jsonb_set(v_payload, '{msg,author}', '"Sarah Okafor"');
  end if;

  if p_type = 'ADMINISTER_MED' then
    select * into r from app_private.prn_rules where tenant_id = t.id and med_id = p_payload ->> 'medId';
    if found then
      v_units := coalesce((p_payload ->> 'units')::int, 1);
      if v_units < 1 or v_units > r.unit_max then raise exception 'PRN_BLOCKED: invalid dose'; end if;
      select max(sim_at), count(*) filter (where v_sim - sim_at < 86400000) into v_last, v_cnt
        from app_private.prn_doses where tenant_id = t.id and epoch in (0, t.demo_epoch) and med_id = r.med_id;
      if v_last is not null and v_sim - v_last < r.min_interval_h * 3600000 then raise exception 'PRN_BLOCKED: minimum interval not met'; end if;
      if v_cnt >= r.max_doses_24h then raise exception 'PRN_BLOCKED: 24-hour maximum reached'; end if;
      if r.para_mg is not null then
        select max(sim_at), coalesce(sum(para_mg) filter (where v_sim - sim_at < 86400000), 0) into v_plast, v_pmg
          from app_private.prn_doses where tenant_id = t.id and epoch in (0, t.demo_epoch) and resident_id = r.resident_id and para_mg is not null;
        if v_plast is not null and v_sim - v_plast < 14400000 then raise exception 'PRN_BLOCKED: paracetamol given within 4 hours'; end if;
        v_limit := case when r.weight_kg < 50 then 60 * r.weight_kg else 4000 end;
        if v_pmg + v_units * r.para_mg > v_limit then raise exception 'PRN_BLOCKED: daily paracetamol limit'; end if;
      end if;
      insert into app_private.prn_doses (tenant_id, epoch, med_id, resident_id, sim_at, units, para_mg)
        values (t.id, t.demo_epoch, r.med_id, r.resident_id, v_sim, v_units, case when r.para_mg is null then null else v_units * r.para_mg end);
    end if;
  end if;

  select coalesce(max(seq), 0), coalesce((array_agg(hash order by seq desc))[1], repeat('0', 64)) into v_seq, v_prev
    from public.events where tenant_id = t.id and epoch = t.demo_epoch;
  insert into public.events (tenant_id, epoch, seq, type, payload, actor_user, actor_name, actor_role, prev_hash, hash)
  values (t.id, t.demo_epoch, v_seq + 1, p_type, v_payload, auth.uid(), v_actor, m.role, v_prev,
    encode(extensions.digest(v_prev || '|' || (v_seq + 1)::text || '|' || p_type || '|' || v_payload::text || '|' || auth.uid()::text, 'sha256'), 'hex'))
  returning * into ev;
  return ev;
end $$;

create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where user_id = auth.uid() order by created_at limit 1;
  if not found or m.role <> 'manager' then raise exception 'FORBIDDEN'; end if;
  update public.tenants set demo_epoch = demo_epoch + 1, epoch_started_at = now(), clock_offset_ms = 0, active_staff = 'David S.' where id = m.tenant_id;
end $$;

create or replace function public.invite_member(p_email text, p_role text, p_display_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where user_id = auth.uid() order by created_at limit 1;
  if not found or m.role <> 'manager' then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('worker', 'manager') then raise exception 'INVALID_ROLE'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254 then raise exception 'INVALID_EMAIL'; end if;
  if length(trim(p_display_name)) < 2 or length(p_display_name) > 80 then raise exception 'INVALID_NAME'; end if;
  insert into app_private.allowed_emails (tenant_id, email, role, display_name, invited_by)
  values (m.tenant_id, lower(trim(p_email)), p_role, trim(p_display_name), auth.uid())
  on conflict (tenant_id, email) do update set role = excluded.role, display_name = excluded.display_name;
end $$;

revoke all on function public.claim_membership(), public.get_my_context(), public.submit_event(text, jsonb, int), public.reset_demo(), public.invite_member(text, text, text) from public, anon;
grant execute on function public.claim_membership(), public.get_my_context(), public.submit_event(text, jsonb, int), public.reset_demo(), public.invite_member(text, text, text) to authenticated;
revoke all on function app_private.sim_now(public.tenants), app_private.block_mutation() from public, anon, authenticated;

alter publication supabase_realtime add table public.events;

-- Demo tenant seed (synthetic people only)
with t as (insert into public.tenants (name, active_staff) values ('Willow Lane Supported Living (demo)', 'David S.') returning id)
, a as (insert into app_private.allowed_emails (tenant_id, email, role, display_name) select id, 'segunmarudavid@gmail.com', 'manager', 'David (demo operator)' from t returning tenant_id)
, p as (insert into app_private.staff_pins (tenant_id, staff_name, staff_role, pin_hash)
        select id, s.n, s.r, extensions.crypt(s.pin, extensions.gen_salt('bf', 10)) from t,
        (values ('David S.', 'Senior Support Worker', '2580'), ('Amina Kamara', 'Support Worker', '1357'), ('Tomasz Nowak', 'Support Worker', '4826')) as s(n, r, pin) returning tenant_id)
, r as (insert into app_private.prn_rules (tenant_id, med_id, resident_id, min_interval_h, max_doses_24h, unit_max, para_mg, weight_kg)
        select id, x.med, x.res, 4, x.maxd, x.umax, x.para, x.w from t,
        (values ('a5', 'arthur', 4, 2, 500, 71), ('l3', 'leo', 2, 1, null, 82), ('m7', 'margaret', 4, 2, 500, 47), ('m8', 'margaret', 4, 2, 500, 47)) as x(med, res, maxd, umax, para, w) returning tenant_id)
insert into app_private.prn_doses (tenant_id, epoch, med_id, resident_id, sim_at, units, para_mg)
select id, 0, d.med, d.res, d.at, d.u, d.para from t,
(values ('m7', 'margaret', 1794291000000, 2, 1000), ('m7', 'margaret', 1794311880000, 2, 1000), ('a5', 'arthur', 1794296700000, 1, 500), ('l3', 'leo', 1794319500000, 1, null)) as d(med, res, at, u, para);
