-- Every website submission (booking, WhatsApp request, waitlist, pro application, enquiry)
-- lands here via /api/submit using the service-role key. No public access.

create table if not exists public.submissions (
  id          text primary key,              -- e.g. MJ-LZ3K9Q
  type        text not null check (type in ('booking', 'request', 'waitlist', 'apply', 'enquiry')),
  data        jsonb not null,
  attribution jsonb not null default '{}'::jsonb,  -- utm_*, fbclid, gclid, landing page
  page        text,
  created_at  timestamptz not null default now()
);

create index if not exists submissions_type_created_idx on public.submissions (type, created_at desc);
create index if not exists submissions_waitlist_idx on public.submissions ((data->>'category'), (data->>'area')) where type = 'waitlist';

alter table public.submissions enable row level security;
-- No policies: only the service role (server) can read or write.
