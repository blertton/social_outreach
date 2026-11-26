do $$ declare first_search uuid; second_search uuid; before_count integer;
  sample jsonb := '[{"external_id":"sample:persist","author_id":"sample:test","author_handle":"sample.test","text":"Synthetic baby announcement","url":null,"posted_at":"2026-11-20T12:00:00Z"}]';
begin
  first_search := public.save_search('00000000-0000-4000-8000-000000000001','baby','fixtures',sample);
  second_search := public.save_search('00000000-0000-4000-8000-000000000001','new baby','fixtures',sample);
  if first_search = second_search then raise exception 'Distinct searches collapsed'; end if;
  if (select count(*) from public.posts where external_id='sample:persist') <> 1 then raise exception 'Post duplicated'; end if;
  if (select count(*) from public.search_results where search_id in (first_search,second_search)) <> 2 then raise exception 'Membership lost'; end if;
  select count(*) into before_count from public.searches;
  begin
    perform public.save_search('00000000-0000-4000-8000-000000000001','baby','fixtures','[{"text":"invalid"}]');
    raise exception 'Invalid ingestion accepted';
  exception when not_null_violation then null; end;
  if (select count(*) from public.searches) <> before_count then raise exception 'Failed ingestion left a partial search'; end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$ begin
  begin
    perform public.save_search(auth.uid(),'forged','fixtures','[]');
    raise exception 'Browser called trusted ingestion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
