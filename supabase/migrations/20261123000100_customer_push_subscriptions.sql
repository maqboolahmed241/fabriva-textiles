-- The customer notification foundation migration already creates these tables.
-- Keep this follow-up migration additive and compatible with that schema.
alter table public.customer_push_subscriptions
  add column if not exists user_agent text;

-- The existing schema uses enabled as the canonical subscription status.
-- No duplicate is_active flag is introduced.
