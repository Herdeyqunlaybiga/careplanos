-- CarePlanOS multi-provider model: providers, services (supported living, care homes), staff, service users,
-- care notes, opt-in safety location. Reads through RLS, writes only through validated security-definer RPCs.

create schema if not exists app_auth;
revoke all on schema app_auth from public, anon;
grant usage on schema app_auth to authenticated;

create table app_private.platform_admin_emails (email text primary key);
insert into app_private.platform_admin_emails values ('segunmarudavid@gmail.com');

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'careplanos_pii_key', 'AES-256 key for identifier columns');

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  cqc_provider_id text check (cqc_provider_id is null or length(cqc_provider_id) <= 20),
  live_data_enabled boolean not null default false,
  live_data_attestation text,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  type text not null check (type in ('supported_living', 'care_home')),
  address text check (address is null or length(address) <= 200),
  postcode text check (postcode is null or postcode ~* '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$'),
  cqc_location_id text check (cqc_location_id is null or length(cqc_location_id) <= 20),
  capacity int check (capacity is null or capacity between 1 and 500),
  created_at timestamptz not null default now()
);
create index services_provider on public.services (provider_id);

create table public.provider_members (
  provider_id uuid not null references public.providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('provider_admin', 'registered_manager', 'senior', 'support_worker')),
  display_name text not null check (length(display_name) between 2 and 80),
  job_title text check (job_title is null or length(job_title) <= 80),
  dbs_checked_on date,
  right_to_work_checked_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (provider_id, user_id)
);
create index provider_members_user on public.provider_members (user_id);

create table public.member_services (
  provider_id uuid not null references public.providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (user_id, service_id)
);
create index member_services_service on public.member_services (service_id);

create table app_private.provider_invites (
  provider_id uuid not null references public.providers(id) on delete cascade,
  email text not null,
  role text not null check (role in ('provider_admin', 'registered_manager', 'senior', 'support_worker')),
  display_name text not null,
  job_title text,
  service_ids uuid[] not null default '{}',
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (provider_id, email)
);

create table public.service_users (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  first_name text not null check (length(first_name) between 1 and 60),
  last_name text not null check (length(last_name) between 1 and 60),
  preferred_name text check (preferred_name is null or length(preferred_name) <= 60),
  date_of_birth date not null check (date_of_birth between date '1900-01-01' and current_date),
  nhs_number_enc bytea,
  nhs_last4 text,
  room text check (room is null or length(room) <= 40),
  needs text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'discharged')),
  admitted_on date not null default current_date,
  discharged_on date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index service_users_service on public.service_users (service_id);

create table public.care_notes (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_user_id uuid not null references public.service_users(id) on delete restrict,
  kind text not null check (kind in ('note', 'incident', 'fluid', 'observation')),
  body text not null check (length(body) between 1 and 2000),
  tags jsonb not null default '{}' check (octet_length(tags::text) < 4000),
  risk boolean not null default false,
  author_user uuid not null,
  author_name text not null,
  created_at timestamptz not null default now()
);
create index care_notes_provider_time on public.care_notes (provider_id, created_at desc);
create index care_notes_user on public.care_notes (service_user_id, created_at desc);

create table public.safety_plans (
  service_user_id uuid primary key references public.service_users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  legal_basis text not null check (legal_basis in ('consent', 'best_interests')),
  decided_by text not null check (length(decided_by) between 2 and 120),
  decision_date date not null,
  review_date date not null,
  centre_lat double precision not null check (centre_lat between -90 and 90),
  centre_lng double precision not null check (centre_lng between -180 and 180),
  radius_m int not null check (radius_m between 50 and 20000),
  active boolean not null default true,
  notes text check (notes is null or length(notes) <= 500),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.location_pings (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_user_id uuid not null references public.service_users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m int,
  distance_m int,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);
create index location_pings_user_time on public.location_pings (service_user_id, recorded_at desc);

create table public.safety_alerts (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  service_user_id uuid not null references public.service_users(id) on delete cascade,
  kind text not null default 'geofence_exit',
  lat double precision not null,
  lng double precision not null,
  distance_m int not null,
  raised_by uuid not null,
  created_at timestamptz not null default now(),
  acknowledged_by uuid,
  acknowledged_name text,
  acknowledged_at timestamptz,
  outcome text check (outcome is null or length(outcome) <= 500)
);
create index safety_alerts_provider on public.safety_alerts (provider_id, created_at desc);

create table public.access_log (
  id bigint generated always as identity primary key,
  provider_id uuid,
  user_id uuid,
  action text not null,
  subject text,
  detail text,
  at timestamptz not null default now()
);
create index access_log_provider on public.access_log (provider_id, at desc);
create trigger access_log_no_update before update or delete on public.access_log for each row execute function app_private.block_mutation();

-- Authorisation helpers (callable from RLS, not exposed through the API schema)
create or replace function app_auth.member_role(p uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.provider_members m where m.provider_id = p and m.user_id = (select auth.uid()) and m.active
$$;
create or replace function app_auth.is_manager(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app_auth.member_role(p) in ('provider_admin', 'registered_manager'), false)
$$;
create or replace function app_auth.can_see_service(s uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.services sv
    join public.provider_members m on m.provider_id = sv.provider_id and m.user_id = (select auth.uid()) and m.active
    where sv.id = s and (m.role in ('provider_admin', 'registered_manager')
      or exists (select 1 from public.member_services ms where ms.user_id = (select auth.uid()) and ms.service_id = s)))
$$;
create or replace function app_auth.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app_private.platform_admin_emails p where p.email = lower(coalesce((select auth.jwt()) ->> 'email', '')))
$$;
revoke all on all functions in schema app_auth from public, anon;
grant execute on all functions in schema app_auth to authenticated;

create or replace function app_private.valid_nhs(n text) returns boolean language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(n, ''), '\s', '', 'g'); s int := 0; c int;
begin
  if d !~ '^[0-9]{10}$' then return false; end if;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  c := 11 - (s % 11);
  if c = 11 then c := 0; end if;
  if c = 10 then return false; end if;
  return c = substr(d, 10, 1)::int;
end $$;

create or replace function app_private.pii_key() returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'careplanos_pii_key'
$$;
revoke all on function app_private.pii_key(), app_private.valid_nhs(text) from public, anon, authenticated;

-- RLS
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.provider_members enable row level security;
alter table public.member_services enable row level security;
alter table public.service_users enable row level security;
alter table public.care_notes enable row level security;
alter table public.safety_plans enable row level security;
alter table public.location_pings enable row level security;
alter table public.safety_alerts enable row level security;
alter table public.access_log enable row level security;

create policy providers_read on public.providers for select to authenticated using (app_auth.member_role(id) is not null);
create policy services_read on public.services for select to authenticated using (app_auth.can_see_service(id));
create policy members_read on public.provider_members for select to authenticated using (app_auth.member_role(provider_id) is not null);
create policy member_services_read on public.member_services for select to authenticated using (app_auth.member_role(provider_id) is not null);
create policy service_users_read on public.service_users for select to authenticated using (app_auth.can_see_service(service_id));
create policy care_notes_read on public.care_notes for select to authenticated using (app_auth.can_see_service(service_id));
create policy safety_plans_read on public.safety_plans for select to authenticated
  using (exists (select 1 from public.service_users su where su.id = safety_plans.service_user_id and app_auth.can_see_service(su.service_id)));
create policy location_pings_read on public.location_pings for select to authenticated using (app_auth.is_manager(provider_id));
create policy safety_alerts_read on public.safety_alerts for select to authenticated using (app_auth.can_see_service(service_id));
create policy access_log_read on public.access_log for select to authenticated using (app_auth.is_manager(provider_id));

revoke all on public.providers, public.services, public.provider_members, public.member_services, public.service_users, public.care_notes,
  public.safety_plans, public.location_pings, public.safety_alerts, public.access_log from anon, authenticated;
grant select on public.providers, public.services, public.provider_members, public.member_services, public.care_notes,
  public.safety_plans, public.location_pings, public.safety_alerts, public.access_log to authenticated;
grant select (id, provider_id, service_id, first_name, last_name, preferred_name, date_of_birth, nhs_last4, room, needs, status, admitted_on, discharged_on, created_at)
  on public.service_users to authenticated;

-- Platform owner functions
create or replace function public.platform_list_providers() returns table (id uuid, name text, cqc_provider_id text, live_data_enabled boolean, services bigint, members bigint, pending_invites bigint, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not app_auth.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  return query select p.id, p.name, p.cqc_provider_id, p.live_data_enabled,
    (select count(*) from public.services s where s.provider_id = p.id),
    (select count(*) from public.provider_members m where m.provider_id = p.id),
    (select count(*) from app_private.provider_invites i where i.provider_id = p.id), p.created_at
  from public.providers p order by p.created_at desc;
end $$;

create or replace function public.platform_create_provider(p_name text, p_cqc_provider_id text, p_admin_email text, p_admin_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_auth.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if p_admin_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_admin_email) > 254 then raise exception 'INVALID_EMAIL'; end if;
  if length(trim(coalesce(p_admin_name, ''))) < 2 then raise exception 'INVALID_NAME'; end if;
  insert into public.providers (name, cqc_provider_id) values (trim(p_name), nullif(trim(coalesce(p_cqc_provider_id, '')), '')) returning id into v_id;
  insert into app_private.provider_invites (provider_id, email, role, display_name, invited_by)
  values (v_id, lower(trim(p_admin_email)), 'provider_admin', trim(p_admin_name), auth.uid());
  insert into public.access_log (provider_id, user_id, action, detail) values (v_id, auth.uid(), 'PROVIDER_CREATED', 'Admin invited: ' || lower(trim(p_admin_email)));
  return v_id;
end $$;

create or replace function public.platform_set_live_data(p_provider uuid, p_enabled boolean, p_attestation text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_auth.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if p_enabled and length(trim(coalesce(p_attestation, ''))) < 40 then raise exception 'ATTESTATION_REQUIRED'; end if;
  update public.providers set live_data_enabled = p_enabled, live_data_attestation = case when p_enabled then trim(p_attestation) else live_data_attestation end where id = p_provider;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.access_log (provider_id, user_id, action, detail) values (p_provider, auth.uid(), case when p_enabled then 'LIVE_DATA_ENABLED' else 'LIVE_DATA_DISABLED' end, left(p_attestation, 500));
end $$;

-- Membership
create or replace function public.claim_provider_memberships() returns int
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', '')); i record; n int := 0;
begin
  if auth.uid() is null or v_email = '' then return 0; end if;
  for i in select * from app_private.provider_invites where email = v_email loop
    insert into public.provider_members (provider_id, user_id, role, display_name, job_title)
    values (i.provider_id, auth.uid(), i.role, i.display_name, i.job_title)
    on conflict (provider_id, user_id) do update set role = excluded.role, display_name = excluded.display_name, active = true;
    insert into public.member_services (provider_id, user_id, service_id)
    select i.provider_id, auth.uid(), s.id from public.services s where s.id = any(i.service_ids) and s.provider_id = i.provider_id
    on conflict do nothing;
    delete from app_private.provider_invites where provider_id = i.provider_id and email = v_email;
    insert into public.access_log (provider_id, user_id, action, detail) values (i.provider_id, auth.uid(), 'MEMBERSHIP_CLAIMED', i.role);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.upsert_service(p_provider uuid, p_id uuid, p_name text, p_type text, p_address text, p_postcode text, p_cqc_location_id text, p_capacity int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_auth.is_manager(p_provider) then raise exception 'FORBIDDEN'; end if;
  if p_id is null then
    insert into public.services (provider_id, name, type, address, postcode, cqc_location_id, capacity)
    values (p_provider, trim(p_name), p_type, nullif(trim(coalesce(p_address, '')), ''), nullif(upper(trim(coalesce(p_postcode, ''))), ''), nullif(trim(coalesce(p_cqc_location_id, '')), ''), p_capacity)
    returning id into v_id;
  else
    update public.services set name = trim(p_name), type = p_type, address = nullif(trim(coalesce(p_address, '')), ''), postcode = nullif(upper(trim(coalesce(p_postcode, ''))), ''),
      cqc_location_id = nullif(trim(coalesce(p_cqc_location_id, '')), ''), capacity = p_capacity
    where id = p_id and provider_id = p_provider returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  insert into public.access_log (provider_id, user_id, action, subject) values (p_provider, auth.uid(), case when p_id is null then 'SERVICE_CREATED' else 'SERVICE_UPDATED' end, v_id::text);
  return v_id;
end $$;

create or replace function public.invite_provider_member(p_provider uuid, p_email text, p_role text, p_display_name text, p_job_title text, p_service_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_user uuid;
begin
  if not app_auth.is_manager(p_provider) then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('provider_admin', 'registered_manager', 'senior', 'support_worker') then raise exception 'INVALID_ROLE'; end if;
  if p_role = 'provider_admin' and app_auth.member_role(p_provider) <> 'provider_admin' then raise exception 'FORBIDDEN'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'INVALID_EMAIL'; end if;
  if length(trim(coalesce(p_display_name, ''))) < 2 or length(p_display_name) > 80 then raise exception 'INVALID_NAME'; end if;
  if exists (select 1 from unnest(coalesce(p_service_ids, '{}')) sid where not exists (select 1 from public.services s where s.id = sid and s.provider_id = p_provider)) then raise exception 'INVALID_SERVICE'; end if;
  select u.id into v_user from auth.users u join public.provider_members m on m.user_id = u.id and m.provider_id = p_provider where lower(u.email) = v_email;
  if v_user is not null then
    update public.provider_members set role = p_role, display_name = trim(p_display_name), job_title = nullif(trim(coalesce(p_job_title, '')), ''), active = true where provider_id = p_provider and user_id = v_user;
    delete from public.member_services where user_id = v_user and provider_id = p_provider;
    insert into public.member_services (provider_id, user_id, service_id) select p_provider, v_user, unnest(coalesce(p_service_ids, '{}')) on conflict do nothing;
  else
    insert into app_private.provider_invites (provider_id, email, role, display_name, job_title, service_ids, invited_by)
    values (p_provider, v_email, p_role, trim(p_display_name), nullif(trim(coalesce(p_job_title, '')), ''), coalesce(p_service_ids, '{}'), auth.uid())
    on conflict (provider_id, email) do update set role = excluded.role, display_name = excluded.display_name, job_title = excluded.job_title, service_ids = excluded.service_ids;
  end if;
  insert into public.access_log (provider_id, user_id, action, detail) values (p_provider, auth.uid(), 'MEMBER_INVITED', v_email || ' as ' || p_role);
end $$;

create or replace function public.list_pending_invites(p_provider uuid) returns table (email text, role text, display_name text, job_title text, service_ids uuid[], created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not app_auth.is_manager(p_provider) then raise exception 'FORBIDDEN'; end if;
  return query select i.email, i.role, i.display_name, i.job_title, i.service_ids, i.created_at from app_private.provider_invites i where i.provider_id = p_provider order by i.created_at desc;
end $$;

create or replace function public.update_member_checks(p_provider uuid, p_user uuid, p_dbs date, p_rtw date, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_auth.is_manager(p_provider) then raise exception 'FORBIDDEN'; end if;
  if p_user = auth.uid() and p_active = false then raise exception 'CANNOT_DEACTIVATE_SELF'; end if;
  if (p_dbs is not null and p_dbs > current_date) or (p_rtw is not null and p_rtw > current_date) then raise exception 'INVALID_DATE'; end if;
  update public.provider_members set dbs_checked_on = p_dbs, right_to_work_checked_on = p_rtw, active = p_active where provider_id = p_provider and user_id = p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.access_log (provider_id, user_id, action, subject) values (p_provider, auth.uid(), 'MEMBER_UPDATED', p_user::text);
end $$;

-- Service users
create or replace function public.enrol_service_user(p_service uuid, p_first text, p_last text, p_preferred text, p_dob date, p_nhs text, p_room text, p_needs text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.services; p public.providers; v_id uuid; v_nhs text := regexp_replace(coalesce(p_nhs, ''), '\s', '', 'g');
begin
  select * into s from public.services where id = p_service;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into p from public.providers where id = s.provider_id;
  if coalesce(app_auth.member_role(s.provider_id), '') not in ('provider_admin', 'registered_manager', 'senior') or not app_auth.can_see_service(p_service) then raise exception 'FORBIDDEN'; end if;
  if not p.live_data_enabled then raise exception 'LIVE_DATA_DISABLED'; end if;
  if v_nhs <> '' and not app_private.valid_nhs(v_nhs) then raise exception 'INVALID_NHS'; end if;
  if coalesce(array_length(p_needs, 1), 0) > 12 or exists (select 1 from unnest(coalesce(p_needs, '{}')) x where length(x) > 60) then raise exception 'INVALID_NEEDS'; end if;
  insert into public.service_users (provider_id, service_id, first_name, last_name, preferred_name, date_of_birth, nhs_number_enc, nhs_last4, room, needs, created_by)
  values (s.provider_id, p_service, trim(p_first), trim(p_last), nullif(trim(coalesce(p_preferred, '')), ''), p_dob,
    case when v_nhs = '' then null else extensions.pgp_sym_encrypt(v_nhs, app_private.pii_key(), 'cipher-algo=aes256') end,
    case when v_nhs = '' then null else right(v_nhs, 4) end, nullif(trim(coalesce(p_room, '')), ''), coalesce(p_needs, '{}'), auth.uid())
  returning id into v_id;
  insert into public.access_log (provider_id, user_id, action, subject) values (s.provider_id, auth.uid(), 'SERVICE_USER_ENROLLED', v_id::text);
  return v_id;
end $$;

create or replace function public.discharge_service_user(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare su public.service_users;
begin
  select * into su from public.service_users where id = p_id;
  if not found or not app_auth.is_manager(su.provider_id) then raise exception 'FORBIDDEN'; end if;
  update public.service_users set status = 'discharged', discharged_on = coalesce(p_date, current_date) where id = p_id;
  update public.safety_plans set active = false where service_user_id = p_id;
  insert into public.access_log (provider_id, user_id, action, subject) values (su.provider_id, auth.uid(), 'SERVICE_USER_DISCHARGED', p_id::text);
end $$;

create or replace function public.reveal_nhs_number(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare su public.service_users;
begin
  select * into su from public.service_users where id = p_id;
  if not found or not app_auth.is_manager(su.provider_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.access_log (provider_id, user_id, action, subject) values (su.provider_id, auth.uid(), 'NHS_NUMBER_REVEALED', p_id::text);
  if su.nhs_number_enc is null then return null; end if;
  return extensions.pgp_sym_decrypt(su.nhs_number_enc, app_private.pii_key());
end $$;

create or replace function public.add_care_note(p_service_user uuid, p_kind text, p_body text, p_tags jsonb, p_risk boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare su public.service_users; m public.provider_members; v_id bigint;
begin
  select * into su from public.service_users where id = p_service_user;
  if not found or su.status <> 'active' or not app_auth.can_see_service(su.service_id) then raise exception 'FORBIDDEN'; end if;
  select * into m from public.provider_members where provider_id = su.provider_id and user_id = auth.uid();
  if (select count(*) from public.care_notes where author_user = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'RATE_LIMITED'; end if;
  if jsonb_typeof(coalesce(p_tags, '{}'::jsonb)) <> 'object' then raise exception 'INVALID_TAGS'; end if;
  insert into public.care_notes (provider_id, service_id, service_user_id, kind, body, tags, risk, author_user, author_name)
  values (su.provider_id, su.service_id, su.id, p_kind, trim(p_body), coalesce(p_tags, '{}'::jsonb), coalesce(p_risk, false), auth.uid(), m.display_name)
  returning id into v_id;
  return v_id;
end $$;

-- Opt-in safety location
create or replace function public.set_safety_plan(p_service_user uuid, p_legal_basis text, p_decided_by text, p_decision_date date, p_review_date date, p_lat double precision, p_lng double precision, p_radius_m int, p_active boolean, p_notes text) returns void
language plpgsql security definer set search_path = '' as $$
declare su public.service_users;
begin
  select * into su from public.service_users where id = p_service_user;
  if not found or not app_auth.is_manager(su.provider_id) then raise exception 'FORBIDDEN'; end if;
  if p_decision_date > current_date or p_review_date <= p_decision_date or p_review_date > p_decision_date + interval '12 months' then raise exception 'INVALID_DATES'; end if;
  insert into public.safety_plans (service_user_id, provider_id, legal_basis, decided_by, decision_date, review_date, centre_lat, centre_lng, radius_m, active, notes, updated_by, updated_at)
  values (su.id, su.provider_id, p_legal_basis, trim(p_decided_by), p_decision_date, p_review_date, p_lat, p_lng, p_radius_m, coalesce(p_active, true), nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), now())
  on conflict (service_user_id) do update set legal_basis = excluded.legal_basis, decided_by = excluded.decided_by, decision_date = excluded.decision_date,
    review_date = excluded.review_date, centre_lat = excluded.centre_lat, centre_lng = excluded.centre_lng, radius_m = excluded.radius_m,
    active = excluded.active, notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now();
  insert into public.access_log (provider_id, user_id, action, subject, detail) values (su.provider_id, auth.uid(), 'SAFETY_PLAN_SET', su.id::text, p_legal_basis || case when coalesce(p_active, true) then ' active' else ' paused' end);
end $$;

create or replace function public.record_safety_location(p_service_user uuid, p_lat double precision, p_lng double precision, p_accuracy_m int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare su public.service_users; pl public.safety_plans; v_d double precision; v_alert bigint;
begin
  select * into su from public.service_users where id = p_service_user;
  if not found or su.status <> 'active' or not app_auth.can_see_service(su.service_id) then raise exception 'FORBIDDEN'; end if;
  select * into pl from public.safety_plans where service_user_id = su.id;
  if not found or not pl.active then raise exception 'NO_ACTIVE_PLAN'; end if;
  if pl.review_date < current_date then raise exception 'PLAN_REVIEW_OVERDUE'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 or coalesce(p_accuracy_m, 0) not between 0 and 5000 then raise exception 'INVALID_LOCATION'; end if;
  if exists (select 1 from public.location_pings where service_user_id = su.id and recorded_by = auth.uid() and recorded_at > now() - interval '20 seconds') then raise exception 'RATE_LIMITED'; end if;
  v_d := 2 * 6371000 * asin(sqrt(power(sin(radians(p_lat - pl.centre_lat) / 2), 2) + cos(radians(pl.centre_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - pl.centre_lng) / 2), 2)));
  insert into public.location_pings (provider_id, service_user_id, lat, lng, accuracy_m, distance_m, recorded_by) values (su.provider_id, su.id, p_lat, p_lng, p_accuracy_m, round(v_d), auth.uid());
  if v_d > pl.radius_m then
    insert into public.safety_alerts (provider_id, service_id, service_user_id, lat, lng, distance_m, raised_by) values (su.provider_id, su.service_id, su.id, p_lat, p_lng, round(v_d), auth.uid()) returning id into v_alert;
  end if;
  return jsonb_build_object('distance_m', round(v_d), 'inside', v_d <= pl.radius_m, 'alert_id', v_alert);
end $$;

create or replace function public.acknowledge_safety_alert(p_alert bigint, p_outcome text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.safety_alerts; m public.provider_members;
begin
  select * into a from public.safety_alerts where id = p_alert;
  if not found or not app_auth.can_see_service(a.service_id) then raise exception 'FORBIDDEN'; end if;
  if a.acknowledged_at is not null then raise exception 'ALREADY_ACKNOWLEDGED'; end if;
  if length(trim(coalesce(p_outcome, ''))) < 5 then raise exception 'OUTCOME_REQUIRED'; end if;
  select * into m from public.provider_members where provider_id = a.provider_id and user_id = auth.uid();
  update public.safety_alerts set acknowledged_by = auth.uid(), acknowledged_name = m.display_name, acknowledged_at = now(), outcome = left(trim(p_outcome), 500) where id = p_alert;
  insert into public.access_log (provider_id, user_id, action, subject, detail) values (a.provider_id, auth.uid(), 'SAFETY_ALERT_ACKNOWLEDGED', p_alert::text, left(trim(p_outcome), 200));
end $$;

do $$
declare f text;
begin
  foreach f in array array['platform_list_providers()', 'platform_create_provider(text,text,text,text)', 'platform_set_live_data(uuid,boolean,text)', 'claim_provider_memberships()',
    'upsert_service(uuid,uuid,text,text,text,text,text,integer)', 'invite_provider_member(uuid,text,text,text,text,uuid[])', 'list_pending_invites(uuid)',
    'update_member_checks(uuid,uuid,date,date,boolean)', 'enrol_service_user(uuid,text,text,text,date,text,text,text[])', 'discharge_service_user(uuid,date)',
    'reveal_nhs_number(uuid)', 'add_care_note(uuid,text,text,jsonb,boolean)', 'set_safety_plan(uuid,text,text,date,date,double precision,double precision,integer,boolean,text)',
    'record_safety_location(uuid,double precision,double precision,integer)', 'acknowledge_safety_alert(bigint,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.care_notes, public.safety_alerts, public.service_users;

-- Data minimisation: location pings purge after 7 days
create extension if not exists pg_cron;
select cron.schedule('purge-location-pings', '15 3 * * *', $$delete from public.location_pings where recorded_at < now() - interval '7 days'$$);
