-- Run once in Supabase SQL Editor. This adds auth roles without changing customer/prize/winner rows.
create table if not exists public.lwv_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lwv_user_roles enable row level security;
drop policy if exists "Users can read own role" on public.lwv_user_roles;
create policy "Users can read own role" on public.lwv_user_roles for select to authenticated using (auth.uid() = user_id);
-- No client insert/update/delete policies. Only server routes using service-role key manage roles.
