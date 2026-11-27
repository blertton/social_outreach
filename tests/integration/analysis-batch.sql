do $$ declare s uuid; batch jsonb; broken jsonb; n integer;
begin
  s := public.save_search('00000000-0000-4000-8000-000000000001','new baby','fixtures',
    '[{"external_id":"sample:b1","author_id":"sample:a","author_handle":"sample.a","text":"Our baby arrived.","posted_at":"2026-11-20T12:00:00Z"},
      {"external_id":"sample:b2","author_id":"sample:b","author_handle":"sample.b","text":"Our daughter arrived.","posted_at":"2026-11-20T12:00:00Z"}]');
  select jsonb_agg(jsonb_build_object('id',id,'analysis',jsonb_build_object('relevance','relevant','sensitivity','none',
    'reason','Synthetic birth announcement.','evidence',source_text_snapshot)) order by original_rank) into batch from public.search_results where search_id=s;
  broken := jsonb_set(batch,'{1,analysis,evidence}','"Invented evidence"');
  begin
    perform public.save_analysis_batch('00000000-0000-4000-8000-000000000001',s,broken,'test/model','batch-v1');
    raise exception 'Invalid evidence accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.search_results where search_id=s and analysis_status <> 'pending') then raise exception 'Partial analysis persisted'; end if;
  begin
    perform public.save_analysis_batch('00000000-0000-4000-8000-000000000002',s,batch,'test/model','batch-v1');
    raise exception 'Foreign analysis saved';
  exception when invalid_parameter_value then null; end;
  n := public.save_analysis_batch('00000000-0000-4000-8000-000000000001',s,batch,'test/model','batch-v1');
  if n <> 2 then raise exception 'Batch not fully saved'; end if;
  n := public.save_analysis_batch('00000000-0000-4000-8000-000000000001',s,batch,'changed/model','batch-v2');
  if n <> 0 or exists(select 1 from public.search_results where search_id=s and analysis_model <> 'test/model') then raise exception 'Completed analysis overwritten'; end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$ begin
  begin
    perform public.save_analysis_batch(auth.uid(),gen_random_uuid(),'[]','forged','forged');
    raise exception 'Browser executed trusted analysis save';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
