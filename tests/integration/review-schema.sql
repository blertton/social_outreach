-- Run only inside the disposable test container initialized by usage-limits.mjs.
insert into public.searches (id,user_id,query,source) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','new baby','fixtures'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','first home','fixtures');
insert into public.posts (id,user_id,source,external_id,author_id,author_handle,text,posted_at) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixtures','example','sample','sample','Synthetic announcement',now());
insert into public.search_results (id,user_id,source,search_id,post_id,original_rank,source_text_snapshot) values
 ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixtures','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0,'Synthetic announcement');
insert into public.drafts (id,user_id,search_result_id,text,prompt_version,model) values
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Congratulations','test','test');

do $$ begin
  begin
    insert into public.posts (user_id,source,external_id,author_id,author_handle,text,posted_at)
      values ('00000000-0000-4000-8000-000000000001','fixtures','example','x','x','x',now());
    raise exception 'Duplicate post accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.search_results (user_id,source,search_id,post_id,original_rank,source_text_snapshot)
      values ('00000000-0000-4000-8000-000000000002','fixtures','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',0,'x');
    raise exception 'Cross-owner link accepted';
  exception when foreign_key_violation then null; end;
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.posts) <> 0 then raise exception 'Foreign posts visible'; end if;
  if (select count(*) from public.search_results) <> 0 then raise exception 'Foreign analysis visible'; end if;
  if (select count(*) from public.drafts) <> 0 then raise exception 'Foreign drafts visible'; end if;
  update public.drafts set status='approved';
  if found then raise exception 'Foreign draft updated'; end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$ begin
  begin
    update public.search_results set analysis_status='complete';
    raise exception 'Client forged analysis';
  exception when insufficient_privilege then null; end;
  begin
    update public.drafts set user_id='00000000-0000-4000-8000-000000000002';
    raise exception 'Client changed draft owner';
  exception when insufficient_privilege then null; end;
end $$;
update public.drafts set status='approved';
do $$ begin
  if not exists (select 1 from public.drafts where status='approved' and reviewed_at is not null and reviewed_by=auth.uid())
    then raise exception 'Approval not persisted'; end if;
end $$;
update public.drafts set text='Edited reply';
do $$ begin
  if not exists (select 1 from public.drafts where status='draft' and reviewed_at is null and reviewed_by is null)
    then raise exception 'Editing did not reset review'; end if;
end $$;
reset role;
delete from public.posts;
do $$ begin
  if exists (select 1 from public.search_results) or exists (select 1 from public.drafts)
    then raise exception 'Dependent content not deleted'; end if;
end $$;
