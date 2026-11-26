begin;
alter table public.searches add column filtered_count integer not null default 0 check (filtered_count >= 0);
alter table public.searches add column skipped_count integer not null default 0 check (skipped_count >= 0);

create function public.save_search(p_user_id uuid, p_query text, p_source text, p_posts jsonb,
  p_filtered integer default 0, p_skipped integer default 0) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_search uuid; v_post uuid; p jsonb; v_rank integer := 0;
begin
  if p_posts is null or jsonb_typeof(p_posts) <> 'array' or jsonb_array_length(p_posts) > 20 then
    raise exception 'Invalid posts' using errcode='22023';
  end if;
  insert into public.searches(user_id, query, source, filtered_count, skipped_count)
    values(p_user_id, p_query, p_source, p_filtered, p_skipped) returning id into v_search;
  for p in select value from jsonb_array_elements(p_posts) loop
    insert into public.posts(user_id, source, external_id, author_id, author_handle, text, url, posted_at)
      values(p_user_id, p_source, p->>'external_id', p->>'author_id', p->>'author_handle', p->>'text', p->>'url', (p->>'posted_at')::timestamptz)
      on conflict(user_id, source, external_id) do update
        set author_handle=excluded.author_handle, text=excluded.text, url=excluded.url, fetched_at=now()
      returning id into v_post;
    insert into public.search_results(user_id, source, search_id, post_id, original_rank, source_text_snapshot)
      values(p_user_id, p_source, v_search, v_post, v_rank, p->>'text') on conflict(search_id, post_id) do nothing;
    v_rank := v_rank + 1;
  end loop;
  return v_search;
end;
$$;
revoke all on function public.save_search(uuid,text,text,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function public.save_search(uuid,text,text,jsonb,integer,integer) to service_role;
commit;
