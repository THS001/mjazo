-- Ops documents for the Phase 2 staff tools: jobs, pros, applications, complaints.
create table if not exists public.ops_docs (
  collection  text not null,
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists ops_docs_collection_idx on public.ops_docs (collection, updated_at desc);

alter table public.ops_docs enable row level security;
-- No policies: only the service role (server) can read or write.
