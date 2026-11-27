begin;
create or replace function public.set_draft_review_state() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.text is distinct from old.text and old.status in ('approved', 'rejected')
    and new.status = old.status then
    new.status := 'draft';
  end if;
  if new.status = 'draft' then
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := pg_catalog.clock_timestamp();
  end if;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.set_draft_review_state() from public, anon, authenticated;
commit;
