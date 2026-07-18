-- ============================================================
-- BloodLink COMPLETE setup (schema + PIN auth + web push)
-- Run this ONCE in the Supabase SQL Editor of a fresh project.
-- Idempotent - safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.donors (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  blood_group       text not null check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  donor_type        text not null default 'blood' check (donor_type in ('blood','plasma','both')),
  city              text not null,
  area              text not null,
  available         boolean not null default true,
  last_available_at timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create table if not exists public.donor_contacts (
  donor_id uuid primary key references public.donors(id) on delete cascade,
  phone    text not null unique,
  pin_hash text
);

create table if not exists public.requests (
  id              uuid primary key default gen_random_uuid(),
  donor_id        uuid not null references public.donors(id) on delete cascade,
  requester_name  text not null,
  requester_phone text not null,
  hospital        text,
  units           int  default 1,
  urgency         text default 'urgent' check (urgency in ('urgent','soon','planned')),
  note            text,
  status          text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at      timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid not null references public.donors(id) on delete cascade,
  subscription jsonb not null,
  endpoint     text generated always as (subscription->>'endpoint') stored,
  created_at   timestamptz not null default now(),
  unique (donor_id, endpoint)
);

create index if not exists idx_donors_search  on public.donors (blood_group, city, available);
create index if not exists idx_requests_donor on public.requests (donor_id);

-- ---------- Row Level Security ----------
alter table public.donors             enable row level security;
alter table public.donor_contacts     enable row level security;
alter table public.requests           enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "public read donors" on public.donors;
create policy "public read donors" on public.donors for select using (true);

grant select on public.donors to anon, authenticated;

-- ---------- Internal verifier (no public grant) ----------
create or replace function public._verify_donor(p_phone text, p_pin text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v record;
begin
  select donor_id, pin_hash into v
    from public.donor_contacts where phone = p_phone;
  if v.donor_id is null then
    raise exception 'No donor found for this phone number.';
  end if;
  if v.pin_hash is null or v.pin_hash <> crypt(p_pin, v.pin_hash) then
    raise exception 'Incorrect PIN.';
  end if;
  return v.donor_id;
end $$;

-- ---------- Public RPCs ----------
create or replace function public.register_donor(
  p_name text, p_blood_group text, p_donor_type text,
  p_city text, p_area text, p_phone text, p_pin text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits.';
  end if;
  if exists (select 1 from public.donor_contacts where phone = p_phone) then
    raise exception 'This phone number is already registered as a donor.';
  end if;
  insert into public.donors (name, blood_group, donor_type, city, area)
  values (p_name, p_blood_group, p_donor_type, p_city, p_area)
  returning id into v_id;
  insert into public.donor_contacts (donor_id, phone, pin_hash)
  values (v_id, p_phone, crypt(p_pin, gen_salt('bf')));
  return v_id;
end $$;

create or replace function public.create_request(
  p_donor_id uuid, p_requester_name text, p_requester_phone text,
  p_hospital text, p_units int, p_urgency text, p_note text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  insert into public.requests
    (donor_id, requester_name, requester_phone, hospital, units, urgency, note)
  values
    (p_donor_id, p_requester_name, p_requester_phone, p_hospital,
     coalesce(p_units, 1), coalesce(p_urgency, 'urgent'), p_note)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_availability(p_phone text, p_pin text, p_available boolean)
returns public.donors
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_row public.donors;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  update public.donors
     set available = p_available,
         last_available_at = case when p_available then now() else last_available_at end
   where id = v_id
   returning * into v_row;
  return v_row;
end $$;

create or replace function public.get_my_profile(p_phone text, p_pin text)
returns public.donors
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_row public.donors;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  select * into v_row from public.donors where id = v_id;
  return v_row;
end $$;

create or replace function public.get_my_requests(p_phone text, p_pin text)
returns setof public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  return query
    select * from public.requests where donor_id = v_id order by created_at desc;
end $$;

create or replace function public.update_request_status(
  p_request_id uuid, p_phone text, p_pin text, p_status text
) returns public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_row public.requests;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  update public.requests set status = p_status
   where id = p_request_id and donor_id = v_id
   returning * into v_row;
  if v_row.id is null then raise exception 'Request not found.'; end if;
  return v_row;
end $$;

create or replace function public.save_push_subscription(
  p_phone text, p_pin text, p_subscription jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  insert into public.push_subscriptions (donor_id, subscription)
  values (v_id, p_subscription)
  on conflict (donor_id, endpoint)
  do update set subscription = excluded.subscription;
end $$;

-- ---------- Grants ----------
grant execute on function public.register_donor(text,text,text,text,text,text,text)   to anon, authenticated;
grant execute on function public.create_request(uuid,text,text,text,int,text,text)    to anon, authenticated;
grant execute on function public.set_availability(text,text,boolean)                  to anon, authenticated;
grant execute on function public.get_my_profile(text,text)                            to anon, authenticated;
grant execute on function public.get_my_requests(text,text)                           to anon, authenticated;
grant execute on function public.update_request_status(uuid,text,text,text)           to anon, authenticated;
grant execute on function public.save_push_subscription(text,text,jsonb)              to anon, authenticated;

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.donors;
exception when others then null; end $$;
