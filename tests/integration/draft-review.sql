-- Run only inside the disposable test container initialized by usage-limits.mjs.
insert into public.searches (id,user_id,query,source) values
 ('11000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','new baby','fixtures');
insert into public.posts (id,user_id,source,external_id,author_id,author_handle,text,posted_at) values
 ('21000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixtures','draft-example','sample','sample','Synthetic announcement',now());
insert into public.search_results (id,user_id,source,search_id,post_id,original_rank,source_text_snapshot) values
 ('31000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixtures','11000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',0,'Synthetic announcement');
insert into public.drafts (id,user_id,search_result_id,text,prompt_version,model,kind) values
 ('41000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Congratulations','test','test','standard');

do $$ begin
  begin
    insert into public.drafts (user_id,search_result_id,text,prompt_version,model,kind)
      values ('00000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','x','t','t','sales');
    raise exception 'Unknown draft kind accepted';
  exception when check_violation then null; end;
end $$;

-- Anonymous callers and missing sessions cannot save reviews.
set role anon;
do $$ begin
  perform public.save_draft_review('41000000-0000-4000-8000-000000000001','x','approved');
  raise exception 'Anonymous save accepted';
exception when insufficient_privilege then null; end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $$ begin
  perform public.save_draft_review('41000000-0000-4000-8000-000000000001','Hijacked','approved');
  raise exception 'Foreign draft saved';
exception when no_data_found then null; end $$;

set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$ begin
  perform public.save_draft_review('41000000-0000-4000-8000-000000000001','x','published');
  raise exception 'Invalid status accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.save_draft_review('41000000-0000-4000-8000-000000000001','   ','draft');
  raise exception 'Blank text accepted';
exception when invalid_parameter_value then null; end $$;

-- Approve, then edit and approve again in one save: the new text is approved.
select * from public.save_draft_review('41000000-0000-4000-8000-000000000001','Congratulations','approved');
do $$ declare first_review timestamptz; begin
  select reviewed_at into first_review from public.drafts where id='41000000-0000-4000-8000-000000000001';
  if first_review is null or (select reviewed_by from public.drafts where id='41000000-0000-4000-8000-000000000001') <> auth.uid() then raise exception 'Approval not recorded'; end if;
  perform pg_sleep(0.01);
  perform public.save_draft_review('41000000-0000-4000-8000-000000000001','Congratulations on the news','approved');
  if not exists (select 1 from public.drafts where id='41000000-0000-4000-8000-000000000001' and text='Congratulations on the news' and status='approved'
    and reviewed_at > first_review and reviewed_by = auth.uid()) then raise exception 'Edited reapproval lost or stale'; end if;
end $$;

-- Saving edited text as a draft clears the decision.
select * from public.save_draft_review('41000000-0000-4000-8000-000000000001','Edited again','draft');
do $$ begin
  if not exists (select 1 from public.drafts where id='41000000-0000-4000-8000-000000000001' and status='draft' and reviewed_at is null and reviewed_by is null)
    then raise exception 'Draft save kept a stale decision'; end if;
end $$;

-- Reject persists; saving unchanged text with the same decision changes nothing.
select * from public.save_draft_review('41000000-0000-4000-8000-000000000001','Edited again','rejected');
do $$ declare before_update timestamptz; begin
  select updated_at into before_update from public.drafts where id='41000000-0000-4000-8000-000000000001';
  perform public.save_draft_review('41000000-0000-4000-8000-000000000001','Edited again','rejected');
  if (select updated_at from public.drafts where id='41000000-0000-4000-8000-000000000001') <> before_update or (select status from public.drafts where id='41000000-0000-4000-8000-000000000001') <> 'rejected'
    then raise exception 'No-op save changed the draft'; end if;
end $$;

-- Users still cannot create drafts or choose their kind directly.
do $$ begin
  begin
    update public.drafts set kind='condolence' where id='41000000-0000-4000-8000-000000000001';
    raise exception 'Client changed draft kind';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.searches where id='11000000-0000-4000-8000-000000000001';
