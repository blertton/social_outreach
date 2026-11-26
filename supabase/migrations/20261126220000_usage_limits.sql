-- Fixed per-user quotas shared by all app instances. No service-role key needed.
begin;

create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('search', 'ai')),
  period text not null check (period in ('minute', 'day')),
  bucket_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (user_id, action, period, bucket_start)
);

alter table public.usage_counters enable row level security;
revoke all on public.usage_counters from public, anon, authenticated;
grant select on public.usage_counters to authenticated;
create policy own_usage_read on public.usage_counters for select to authenticated
  using (user_id = (select auth.uid()));

create function public.reserve_usage(p_action text)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz;
  v_day timestamptz;
  v_minute timestamptz;
  v_day_count integer;
  v_minute_count integer;
  v_day_limit integer;
  v_minute_limit integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_action is null or p_action not in ('search', 'ai') then
    raise exception 'Invalid usage action' using errcode = '22023';
  end if;
  v_day_limit := case p_action when 'search' then 30 else 100 end;
  v_minute_limit := case p_action when 'search' then 10 else 20 end;

  -- Serialize reservations for this user/action across processes; a collision
  -- only serializes unrelated users and cannot grant extra allowance.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_action, 0));
  v_now := pg_catalog.clock_timestamp();
  v_day := pg_catalog.date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_minute := pg_catalog.date_trunc('minute', v_now);
  select coalesce(max(c.count), 0) into v_day_count from public.usage_counters c
    where c.user_id = v_user and c.action = p_action and c.period = 'day' and c.bucket_start = v_day;
  select coalesce(max(c.count), 0) into v_minute_count from public.usage_counters c
    where c.user_id = v_user and c.action = p_action and c.period = 'minute' and c.bucket_start = v_minute;
  if v_day_count >= v_day_limit then
    return query select false, 0, greatest(1, ceil(extract(epoch from (v_day + interval '1 day' - v_now)))::integer);
    return;
  end if;
  if v_minute_count >= v_minute_limit then
    return query select false, v_day_limit - v_day_count,
      greatest(1, ceil(extract(epoch from (v_minute + interval '1 minute' - v_now)))::integer);
    return;
  end if;
  insert into public.usage_counters as c (user_id, action, period, bucket_start, count)
    values (v_user, p_action, 'day', v_day, 1), (v_user, p_action, 'minute', v_minute, 1)
    on conflict (user_id, action, period, bucket_start) do update set count = c.count + 1;
  return query select true, v_day_limit - v_day_count - 1, 0;
end;
$$;

revoke all on function public.reserve_usage(text) from public, anon, authenticated;
grant execute on function public.reserve_usage(text) to authenticated;
commit;
