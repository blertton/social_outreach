begin;

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check (length(trim(query)) between 1 and 300),
  source text not null check (source in ('bluesky', 'fixtures')),
  created_at timestamptz not null default now(),
  unique (id, user_id, source)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('bluesky', 'fixtures')),
  external_id text not null check (length(external_id) between 1 and 500),
  author_id text not null,
  author_handle text not null,
  text text not null check (length(text) between 1 and 10000),
  url text,
  posted_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  unique (user_id, source, external_id),
  unique (id, user_id, source)
);

create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('bluesky', 'fixtures')),
  search_id uuid not null,
  post_id uuid not null,
  original_rank integer not null check (original_rank >= 0),
  source_text_snapshot text not null check (length(source_text_snapshot) between 1 and 10000),
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'complete', 'failed')),
  analysis jsonb,
  analysis_prompt_version text,
  analysis_model text,
  analyzed_at timestamptz,
  analysis_error_code text,
  unique (search_id, post_id),
  unique (id, user_id),
  foreign key (search_id, user_id, source) references public.searches(id, user_id, source) on delete cascade,
  foreign key (post_id, user_id, source) references public.posts(id, user_id, source) on delete cascade,
  check (analysis_status <> 'complete' or (
    analysis is not null and jsonb_typeof(analysis) = 'object' and
    analysis_prompt_version is not null and analysis_model is not null and analyzed_at is not null
  ))
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_result_id uuid not null unique,
  text text not null check (length(text) between 1 and 5000),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  prompt_version text not null,
  model text not null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (search_result_id, user_id) references public.search_results(id, user_id) on delete cascade
);

create index searches_owner_created on public.searches(user_id, created_at desc);
create index posts_owner on public.posts(user_id);
create index results_owner on public.search_results(user_id);
create index results_post on public.search_results(post_id);
create index drafts_owner on public.drafts(user_id);

alter table public.searches enable row level security;
alter table public.posts enable row level security;
alter table public.search_results enable row level security;
alter table public.drafts enable row level security;

revoke all on public.searches, public.posts, public.search_results, public.drafts from public, anon, authenticated;
grant select on public.searches, public.posts, public.search_results, public.drafts to authenticated;
grant update (text, status) on public.drafts to authenticated;
-- Ingestion/model output must be written by trusted server code, not by a
-- signed-in browser forging eligibility. The server must check ownership first.
grant select, insert, update, delete on public.searches, public.posts, public.search_results, public.drafts to service_role;

create policy own_searches on public.searches for select to authenticated using (user_id = (select auth.uid()));
create policy own_posts on public.posts for select to authenticated using (user_id = (select auth.uid()));
create policy own_results on public.search_results for select to authenticated using (user_id = (select auth.uid()));
create policy own_drafts on public.drafts for select to authenticated using (user_id = (select auth.uid()));
create policy edit_own_drafts on public.drafts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.set_draft_review_state() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.text is distinct from old.text and old.status in ('approved', 'rejected') then
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
create trigger draft_review_state before update on public.drafts
  for each row execute function public.set_draft_review_state();

commit;
