-- Customer web-push subscriptions. No public table access: all writes/sends go through the Edge Function.
create table if not exists public.customer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_push_subscriptions enable row level security;
revoke all on public.customer_push_subscriptions from anon, authenticated;
