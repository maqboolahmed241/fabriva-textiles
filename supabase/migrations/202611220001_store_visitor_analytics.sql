-- Secure visitor analytics. Public visitors can submit page-view events only.
create table if not exists public.store_visit_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  page_path text not null default '/',
  viewed_at timestamptz not null default now(),
  constraint store_visit_events_page_path_length check (char_length(page_path) <= 300)
);
create index if not exists store_visit_events_viewed_at_idx on public.store_visit_events (viewed_at desc);
create index if not exists store_visit_events_visitor_viewed_idx on public.store_visit_events (visitor_id, viewed_at desc);

alter table public.store_visit_events enable row level security;
revoke all on table public.store_visit_events from public, anon, authenticated;
grant insert on table public.store_visit_events to anon, authenticated;
grant select on table public.store_visit_events to authenticated;

drop policy if exists store_visit_events_public_insert on public.store_visit_events;
create policy store_visit_events_public_insert on public.store_visit_events
  for insert to anon, authenticated
  with check (visitor_id is not null and char_length(page_path) <= 300);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_view_store_analytics()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles a
    where a.user_id = (select auth.uid())
      and (a.is_owner = true or a.can_manage_settings = true)
  );
$$;
revoke all on function private.can_view_store_analytics() from public, anon;
grant execute on function private.can_view_store_analytics() to authenticated;

drop policy if exists store_visit_events_admin_read on public.store_visit_events;
create policy store_visit_events_admin_read on public.store_visit_events
  for select to authenticated
  using ((select private.can_view_store_analytics()));

create or replace function public.record_store_visit(p_visitor_id uuid, p_page_path text default '/')
returns void language sql security invoker
set search_path = ''
as $$
  insert into public.store_visit_events(visitor_id, page_path)
  values (p_visitor_id, left(coalesce(nullif(p_page_path, ''), '/'), 300));
$$;
revoke all on function public.record_store_visit(uuid, text) from public;
grant execute on function public.record_store_visit(uuid, text) to anon, authenticated;

create or replace function public.get_store_visitor_stats()
returns jsonb language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_views', count(*),
    'unique_visitors', count(distinct visitor_id),
    'today_visitors', count(distinct visitor_id) filter (where viewed_at >= date_trunc('day', now())),
    'month_visitors', count(distinct visitor_id) filter (where viewed_at >= date_trunc('month', now()))
  )
  from public.store_visit_events;
$$;
revoke all on function public.get_store_visitor_stats() from public, anon;
grant execute on function public.get_store_visitor_stats() to authenticated;
