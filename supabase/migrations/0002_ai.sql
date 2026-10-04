-- Mjazo Concierge on WhatsApp: per-number conversation memory (last 20 turns).
create table if not exists public.conversations (
  phone        text primary key,
  messages     jsonb not null default '[]'::jsonb,
  needs_human  boolean not null default false,
  updated_at   timestamptz not null default now()
);

create index if not exists conversations_needs_human_idx on public.conversations (needs_human) where needs_human;

alter table public.conversations enable row level security;
-- No policies: only the service role (server) can read or write.
