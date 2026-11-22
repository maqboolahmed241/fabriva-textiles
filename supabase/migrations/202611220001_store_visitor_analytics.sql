-- Visitor analytics for the storefront. Apply only to an isolated staging database first.
create table if not exists public.store_visit_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  page_path text not null default '/',
  viewed_at timestamptz not null default now()
);
create index if not exists store_visit_events_viewed_at_idx on public.store_visit_events (viewed_at desc);
create index if not exists store_visit_events_visitor_viewed_idx on public.store_visit_events (visitor_id, viewed_at desc);
alter table public.store_visit_events enable row level security;
revoke all on public.store_visit_events from anon, authenticated;

create or replace function public.record_store_visit(p_visitor_id uuid, p_page_path text default '/')
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_visitor_id is null then
    raise exception 'visitor id is required';
  end if;
  insert into public.store_visit_events(visitor_id, page_path)
  values (p_visitor_id, left(coalesce(nullif(p_page_path, ''), '/'), 300));
end;
$$;
revoke all on function public.record_store_visit(uuid, text) from public;
grant execute on function public.record_store_visit(uuid, text) to anon, authenticated;

create or replace function public.get_store_visitor_stats()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_profiles a
    where a.user_id = auth.uid()
      and (a.is_owner = true or a.can_manage_settings = true)
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_views', (select count(*) from public.store_visit_events),
    'unique_visitors', (select count(distinct visitor_id) from public.store_visit_events),
    'today_visitors', (select count(distinct visitor_id) from public.store_visit_events where viewed_at >= date_trunc('day', now())),
    'month_visitors', (select count(distinct visitor_id) from public.store_visit_events where viewed_at >= date_trunc('month', now()))
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_store_visitor_stats() from public, anon;
grant execute on function public.get_store_visitor_stats() to authenticated;
