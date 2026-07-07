-- DailyFuel push notifications — Supabase schema (v0.4.0)
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- One row per subscribed device/browser. The client (signed-in user) manages
-- its own rows under RLS; the dispatch cron reads all rows with the
-- service-role key (server-side only, never shipped to the browser).

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Web Push subscription (endpoint is unique per device/browser)
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  -- IANA timezone of the device, e.g. "Europe/Oslo"
  timezone   text not null default 'UTC',
  -- Snapshot of the reminder settings this device wants
  settings   jsonb not null default '{}'::jsonb,
  -- Dedupe markers: local date (YYYY-MM-DD) each reminder was last handled
  last_creatine_sent date,
  last_calorie_sent  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
