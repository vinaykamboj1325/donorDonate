-- ============================================================
-- BloodLink migration: phone + PIN dashboard login
-- Run in Supabase SQL Editor after schema.sql. Idempotent.
-- ============================================================

create extension if not exists pgcrypto;

-- Hashed PIN lives with the private contact data (never exposed).
alter table public.donor_contacts add column if not exists pin_hash text;

-- Give the existing TEST donor a known PIN (1234) so it stays usable.
update public.donor_contacts
   set pin_hash = crypt('1234', gen_salt('bf'))
 where pin_hash is null;

-- Shared verifier: returns the donor id only when phone + PIN match.
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

-- register_donor now requires a 4-6 digit PIN.
drop function if exists public.register_donor(text,text,text,text,text,text);
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

-- Dashboard RPCs now verify phone + PIN.
drop function if exists public.set_availability(text,boolean);
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

drop function if exists public.get_my_profile(text);
create or replace function public.get_my_profile(p_phone text, p_pin text)
returns public.donors
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_row public.donors;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  select * into v_row from public.donors where id = v_id;
  return v_row;
end $$;

drop function if exists public.get_my_requests(text);
create or replace function public.get_my_requests(p_phone text, p_pin text)
returns setof public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  v_id := public._verify_donor(p_phone, p_pin);
  return query
    select * from public.requests where donor_id = v_id order by created_at desc;
end $$;

drop function if exists public.update_request_status(uuid,text,text);
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

-- Grants (the verifier stays internal - no grant on purpose).
grant execute on function public.register_donor(text,text,text,text,text,text,text)   to anon, authenticated;
grant execute on function public.set_availability(text,text,boolean)                  to anon, authenticated;
grant execute on function public.get_my_profile(text,text)                            to anon, authenticated;
grant execute on function public.get_my_requests(text,text)                           to anon, authenticated;
grant execute on function public.update_request_status(uuid,text,text,text)           to anon, authenticated;
