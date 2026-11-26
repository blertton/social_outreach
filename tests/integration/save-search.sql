do $$ declare first_search uuid; second_search uuid; before_count integer;
  sample jsonb := '[{"external_id":"sample:persist","author_id":"sample:test","author_handle":"sample.test","text":"Synthetic baby announcement","url":null,"posted_at":"2026-11-20T12:00:00Z"}]';
begin
  first_search := public.save_search('00000000-0000-4000-8000-000000000001','baby','fixtures',sample);
  second_search := public.save_search('00000000-0000-4000-8000-000000000001','new baby','fixtures',sample);
  if first_search = second_search then raise exception 'Distinct searches collapsed'; end if;
  if (select count(*) from public.posts where external_id='sample:persist') <> 1 then raise exception 'Post duplicated'; end if;
  if (select count(*) from public.search_results where search_id in (first_search,second_search)) <> 2 then raise exception 'Membership lost'; end if;
  -- Analysis belongs to the query-specific result, not the deduplicated post.
  begin
    update public.search_results set analysis_status='complete' where search_id=first_search;
    raise exception 'Incomplete analysis accepted';
  exception when check_violation then null; end;
  update public.search_results set analysis_status='complete',
    analysis='{"relevance":"relevant","sensitivity":"none","reason":"Synthetic birth announcement.","evidence":"Synthetic baby announcement"}',
    analysis_model='test/model', analysis_prompt_version='analysis-v1', analyzed_at=now()
    where search_id=first_search;
  if not exists (select 1 from public.search_results where search_id=second_search and analysis_status='pending' and analysis is null)
    then raise exception 'Analysis leaked across queries'; end if;
  update public.posts set text='Changed canonical text' where external_id='sample:persist';
  if exists (select 1 from public.search_results where search_id in (first_search,second_search) and source_text_snapshot <> 'Synthetic baby announcement')
    then raise exception 'Reviewed source snapshot changed'; end if;
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
