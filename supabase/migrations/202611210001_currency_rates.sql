-- FABRIVA TEXTILES: PKR-base exchange-rate cache with owner-controlled manual overrides.
-- Apply only to a dedicated staging Supabase project before any production rollout.
create table if not exists public.currency_rates (
  currency_code text primary key check (currency_code ~ '^[A-Z]{3}$'),
  currency_name text not null,
  rate_to_pkr numeric(20,8) not null check (rate_to_pkr > 0),
  rate_mode text not null default 'automatic' check (rate_mode in ('automatic','manual')),
  source text not null default 'Frankfurter',
  rate_date date,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.currency_rates enable row level security;
drop policy if exists "Public can read active currency rates" on public.currency_rates;
create policy "Public can read active currency rates" on public.currency_rates
  for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage currency rates" on public.currency_rates;
create policy "Admins manage currency rates" on public.currency_rates
  for all to authenticated
  using (exists (select 1 from public.admin_profiles a where a.user_id = auth.uid() and (a.is_owner or a.can_manage_settings)))
  with check (exists (select 1 from public.admin_profiles a where a.user_id = auth.uid() and (a.is_owner or a.can_manage_settings)));
grant select on public.currency_rates to anon, authenticated;
grant insert, update, delete on public.currency_rates to authenticated;
comment on table public.currency_rates is 'Exchange rates expressed as local currency units? No: rate_to_pkr = PKR value of one unit of foreign currency; PKR row is 1.00000000. Display conversion = PKR amount / rate_to_pkr.';
