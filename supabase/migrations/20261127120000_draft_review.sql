begin;
-- Record which policy produced a draft so the UI and saved reviews show it.
alter table public.drafts add column kind text not null default 'standard'
  check (kind in ('standard', 'condolence'));

-- Saves edited text and a review decision together for the signed-in owner.
-- Runs as the caller, so RLS and column grants still apply. A text change always
-- clears the previous decision first; the requested decision is then applied
-- explicitly, so "edit an approved draft and approve it again" is unambiguous.
create function public.save_draft_review(p_draft_id uuid, p_text text, p_status text)
returns table (draft_status text, draft_text text, reviewed_at timestamptz, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_status is null or p_status not in ('draft', 'approved', 'rejected') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;
  if p_text is null or length(trim(p_text)) = 0 or length(p_text) > 5000 then
    raise exception 'Invalid draft text' using errcode = '22023';
  end if;
  update public.drafts d set text = p_text, status = 'draft'
    where d.id = p_draft_id and d.user_id = auth.uid() and d.text is distinct from p_text;
  update public.drafts d set status = p_status
    where d.id = p_draft_id and d.user_id = auth.uid() and d.status is distinct from p_status;
  return query select d.status, d.text, d.reviewed_at, d.updated_at from public.drafts d
    where d.id = p_draft_id and d.user_id = auth.uid();
  if not found then raise exception 'Draft unavailable' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.save_draft_review(uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_draft_review(uuid, text, text) to authenticated;
commit;
