-- ============================================================
-- BloodLink migration: web push subscriptions
-- Run in Supabase SQL Editor after migration-pin.sql. Idempotent.
-- ============================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid not null references public.donors(id) on delete cascade,
  subscription jsonb not null,
  endpoint     text generated always as (subscription->>'endpoint') stored,
  created_at   timestamptz not null default now(),
  unique (donor_id, endpoint)
);

-- RLS on, no public policy: only SECURITY DEFINER RPCs and the
-- service role (Edge Function) can touch this table.
alter table public.push_subscriptions enable row level security;

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

grant execute on function public.save_push_subscription(text,text,jsonb) to anon, authenticated;
