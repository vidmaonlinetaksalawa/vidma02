-- ============================================================
-- Class Management Portal — Supabase schema
-- Run this ENTIRE file once in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- 1. Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'student' check (role in ('student', 'admin')),
  paid_months jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  month text not null,                 -- e.g. '2026-09'
  slip_path text,                      -- path inside the 'slips' storage bucket
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.settings (
  id text primary key,                 -- always the single row 'classInfo'
  zoom_link text,
  recordings jsonb not null default '[]'::jsonb
);

-- ---------- 2. Auto-create a profile row whenever someone signs up ----------
-- This runs server-side with elevated privileges, so the client can NEVER
-- set its own role to 'admin' — every new signup is forced to 'student'.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, paid_months)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    'student',
    '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 3. Helper: is the current user an admin? ----------
-- SECURITY DEFINER lets this check the profiles table without
-- triggering infinite recursion in the profiles RLS policies below.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- 4. Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

-- profiles: a user can read their own row; admins can read everyone's.
-- No client-side INSERT policy exists — rows are only ever created by the
-- trigger above, so nobody can create a row with role='admin' from the app.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- Only admins can update profiles (this is what flips paid_months / role).
create policy "profiles_update_admin_only"
  on public.profiles for update
  using (public.is_admin());

-- payments: students see/create only their own; only admins can update (approve/reject).
create policy "payments_select_own_or_admin"
  on public.payments for select
  using (auth.uid() = student_id or public.is_admin());

create policy "payments_insert_own_pending"
  on public.payments for insert
  with check (auth.uid() = student_id and status = 'pending');

create policy "payments_update_admin_only"
  on public.payments for update
  using (public.is_admin());

-- settings: any signed-in user can read; only admins can write.
create policy "settings_select_authenticated"
  on public.settings for select
  using (auth.role() = 'authenticated');

create policy "settings_write_admin_only"
  on public.settings for insert
  with check (public.is_admin());

create policy "settings_update_admin_only"
  on public.settings for update
  using (public.is_admin());

-- ---------- 5. Storage bucket for bank-slip screenshots ----------
-- Private bucket — files are only ever served via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;

-- Students can upload only into a folder named after their own UID:
-- path pattern is "{uid}/{filename}"
create policy "slips_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'slips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A student can read their own slip; admins can read any (needed for the
-- admin dashboard's slip preview / signed-URL generation).
create policy "slips_select_own_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'slips'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ============================================================
-- Done. Next: create your admin account (see README step "Create your
-- Admin account") by signing up normally, then flipping role to 'admin'
-- for your row in the profiles table via Table Editor.
-- ============================================================
