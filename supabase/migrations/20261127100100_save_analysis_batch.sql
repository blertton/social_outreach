begin;
create function public.save_analysis_batch(p_user_id uuid, p_search_id uuid, p_results jsonb,
  p_model text, p_prompt_version text) returns integer
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) not between 1 and 5
    or coalesce(length(trim(p_model)),0) not between 1 and 200
    or coalesce(length(trim(p_prompt_version)),0) not between 1 and 100 then
    raise exception 'Invalid analysis batch' using errcode='22023';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_results)) <> jsonb_array_length(p_results) then
    raise exception 'Duplicate analysis IDs' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_results) item
    left join public.search_results r on r.id=(item.value->>'id')::uuid and r.user_id=p_user_id and r.search_id=p_search_id
    where r.id is null or jsonb_typeof(item.value->'analysis') is distinct from 'object'
      or coalesce(item.value->'analysis'->>'relevance','') not in ('relevant','irrelevant','uncertain')
      or coalesce(item.value->'analysis'->>'sensitivity','') not in ('none','bereavement','other','uncertain')
      or coalesce(length(trim(item.value->'analysis'->>'reason')),0) not between 1 and 600
      or coalesce(length(trim(item.value->'analysis'->>'evidence')),0) not between 1 and 500
      or strpos(r.source_text_snapshot,item.value->'analysis'->>'evidence')=0
  ) then raise exception 'Invalid or unavailable analysis result' using errcode='22023'; end if;
  update public.search_results r set analysis_status='complete', analysis=item.value->'analysis',
    analysis_model=p_model, analysis_prompt_version=p_prompt_version, analyzed_at=clock_timestamp(), analysis_error_code=null
    from jsonb_array_elements(p_results) item
    where r.id=(item.value->>'id')::uuid and r.user_id=p_user_id and r.search_id=p_search_id and r.analysis_status <> 'complete';
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.save_analysis_batch(uuid,uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.save_analysis_batch(uuid,uuid,jsonb,text,text) to service_role;
commit;
