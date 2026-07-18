-- ============================================================
-- BloodLink schema for Supabase
-- Run this in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (idempotent).
-- ============================================================

-- 1) PUBLIC donor info: searchable, safe to expose, realtime-friendly.
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

-- 2) PRIVATE contact info: never exposed to the anon/public role.
create table if not exists public.donor_contacts (
  donor_id uuid primary key references public.donors(id) on delete cascade,
  phone    text not null unique
);

-- 3) Requests (seeker -> donor). Donor's phone is NOT stored here.
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

create index if not exists idx_donors_search  on public.donors (blood_group, city, available);
create index if not exists idx_requests_donor on public.requests (donor_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.donors         enable row level security;
alter table public.donor_contacts enable row level security;
alter table public.requests       enable row level security;

-- donors: anyone may READ the public columns. Writes go through RPCs only.
drop policy if exists "public read donors" on public.donors;
create policy "public read donors" on public.donors
  for select using (true);

-- donor_contacts & requests: RLS on with NO permissive policy => locked to the
-- anon/authenticated roles. The RPCs below are SECURITY DEFINER, so they run as
-- the table owner and are the ONLY path to this data.

grant select on public.donors to anon, authenticated;

-- ============================================================
-- RPCs (SECURITY DEFINER = run as owner, safely bypass RLS)
-- ============================================================

-- Register a donor and store the phone privately.
create or replace function public.register_donor(
  p_name text, p_blood_group text, p_donor_type text,
  p_city text, p_area text, p_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if exists (select 1 from public.donor_contacts where phone = p_phone) then
    raise exception 'This phone number is already registered as a donor.';
  end if;

  insert into public.donors (name, blood_group, donor_type, city, area)
  values (p_name, p_blood_group, p_donor_type, p_city, p_area)
  returning id into v_id;

  insert into public.donor_contacts (donor_id, phone) values (v_id, p_phone);
  return v_id;
end $$;

-- Donor toggles their own availability (identified by their private phone).
create or replace function public.set_availability(p_phone text, p_available boolean)
returns public.donors
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_row public.donors;
begin
  select donor_id into v_id from public.donor_contacts where phone = p_phone;
  if v_id is null then raise exception 'No donor found for this phone number.'; end if;

  update public.donors
     set available = p_available,
         last_available_at = case when p_available then now() else last_available_at end
   where id = v_id
   returning * into v_row;
  return v_row;
end $$;

-- Seeker creates a request to a donor. Donor's phone is never returned.
create or replace function public.create_request(
  p_donor_id uuid, p_requester_name text, p_requester_phone text,
  p_hospital text, p_units int, p_urgency text, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
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

-- Donor loads their own profile by phone (for the dashboard).
create or replace function public.get_my_profile(p_phone text)
returns public.donors
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_row public.donors;
begin
  select donor_id into v_id from public.donor_contacts where phone = p_phone;
  if v_id is null then raise exception 'No donor found for this phone number.'; end if;
  select * into v_row from public.donors where id = v_id;
  return v_row;
end $$;

-- Donor lists requests addressed to them (includes seeker's phone so the
-- donor can WhatsApp the seeker directly).
create or replace function public.get_my_requests(p_phone text)
returns setof public.requests
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select donor_id into v_id from public.donor_contacts where phone = p_phone;
  if v_id is null then raise exception 'No donor found for this phone number.'; end if;
  return query
    select * from public.requests where donor_id = v_id order by created_at desc;
end $$;

-- Donor accepts / declines a request.
create or replace function public.update_request_status(
  p_request_id uuid, p_phone text, p_status text
) returns public.requests
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_row public.requests;
begin
  select donor_id into v_id from public.donor_contacts where phone = p_phone;
  if v_id is null then raise exception 'No donor found for this phone number.'; end if;

  update public.requests set status = p_status
   where id = p_request_id and donor_id = v_id
   returning * into v_row;
  if v_row.id is null then raise exception 'Request not found.'; end if;
  return v_row;
end $$;

-- Allow the app (anon key) to CALL the functions above.
grant execute on function public.register_donor(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.set_availability(text,boolean)                to anon, authenticated;
grant execute on function public.create_request(uuid,text,text,text,int,text,text) to anon, authenticated;
grant execute on function public.get_my_profile(text)                          to anon, authenticated;
grant execute on function public.get_my_requests(text)                         to anon, authenticated;
grant execute on function public.update_request_status(uuid,text,text)         to anon, authenticated;

-- Enable realtime broadcasts on the public donors table (ignore if already added).
do $$ begin
  alter publication supabase_realtime add table public.donors;
exception when others then null; end $$;
