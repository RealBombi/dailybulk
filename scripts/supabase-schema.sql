-- DailyFuel cloud sync — Supabase schema (v0.2.0)
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Design: one JSONB row per user holding the entire app payload (the same
-- shape as the local backup / export file). This is the safest, fastest path
-- from localStorage and keeps import/export compatible. No relational splitting
-- for v0.2.0.

create table if not exists public.user_data (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One row per user → upsert on user_id from the client.
  unique (user_id)
);

-- Row Level Security: every policy is scoped to the authenticated user's own
-- row, so a user can never see or touch another user's data.
alter table public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_data_delete_own" on public.user_data;
create policy "user_data_delete_own"
  on public.user_data for delete
  using (auth.uid() = user_id);
