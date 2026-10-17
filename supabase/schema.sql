-- Lucky Wheel VIP schema
-- IMPORTANT: This starter schema is intentionally conservative. Do not enable anonymous write access
-- for a real event with personal data. Add Supabase Auth, server-side APIs and role-based RLS policies
-- before production. The sample client-side app can operate in local demo mode without this schema.

create extension if not exists pgcrypto;

create table if not exists public.lwv_customers (
  id text primary key,
  full_name text not null,
  phone text not null,
  customer_code text,
  advisor_name text,
  agency text,
  survey_rating integer,
  survey_interest text,
  survey_feedback text,
  consent boolean default false,
  eligible boolean default true,
  event_name text,
  event_date date,
  event_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lwv_customers_phone_normalized_idx
  on public.lwv_customers (regexp_replace(phone, '\\s', '', 'g'));

create table if not exists public.lwv_prizes (
  id text primary key,
  name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  won integer not null default 0 check (won >= 0),
  active boolean not null default true
);

create table if not exists public.lwv_winners (
  id text primary key,
  customer_id text not null,
  full_name text not null,
  phone text not null,
  customer_code text,
  advisor_name text,
  prize_name text not null,
  won_at timestamptz not null default now(),
  constraint lwv_winners_customer_once unique (customer_id)
);

-- Keep Row Level Security enabled. Add narrowly scoped policies only after implementing auth.
alter table public.lwv_customers enable row level security;
alter table public.lwv_prizes enable row level security;
alter table public.lwv_winners enable row level security;

-- No anonymous policies are created intentionally. The browser will show a Supabase permissions
-- warning until secure authenticated policies / server-side access are configured.
-- Never paste SUPABASE_SERVICE_ROLE_KEY into NEXT_PUBLIC_* variables or client-side code.

-- Migration for existing projects: run these statements once if lwv_customers already exists.
alter table public.lwv_customers add column if not exists event_name text;
alter table public.lwv_customers add column if not exists event_date date;
alter table public.lwv_customers add column if not exists event_time text;
