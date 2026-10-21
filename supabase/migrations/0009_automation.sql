-- Automation (platform stage 5): the outbox worker sends customer messages, offers visits to pros
-- (auto-assign), drafts the weekly payout run and sends the opt-in nudges. Each rule can be switched
-- on or off in mission control; every message is kept in `notifications` (only logged until a
-- WhatsApp, email or push provider is set). Builds on 0005–0008 (never edit those once they have
-- run live). Safe to run more than once.

create table if not exists public.automation_rules (
  key         text primary key,                     -- confirm, reminder, onTheWay, rateVisit, autoAssign, …
  enabled     boolean not null default false,
  config      jsonb not null default '{}'::jsonb,   -- e.g. the WhatsApp template name, the auto-assign mode
  updated_by  text,
  updated_at  timestamptz not null default now()
);

-- What each message is, who it's for, why (one per reason: dedupe_key), and how sending went.
alter table public.notifications add column if not exists rule text;
alter table public.notifications add column if not exists dedupe_key text;
alter table public.notifications add column if not exists booking_id text;
alter table public.notifications add column if not exists customer_id text;
alter table public.notifications add column if not exists pro_id text;
alter table public.notifications add column if not exists lang text not null default 'en';
alter table public.notifications add column if not exists subject text;
alter table public.notifications add column if not exists params jsonb;
alter table public.notifications add column if not exists attempts integer not null default 0;
alter table public.notifications add column if not exists provider_id text;
create unique index if not exists notifications_dedupe_idx on public.notifications (dedupe_key) where dedupe_key is not null;
create index if not exists notifications_recent_idx on public.notifications (created_at desc);
create index if not exists notifications_recipient_idx on public.notifications (recipient, rule, created_at desc);
-- "sending": claimed by a worker (a stuck one goes back to the queue after a while).
alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check check (status in ('queued', 'sending', 'sent', 'failed', 'logged', 'skipped'));

-- The worker's retries.
alter table public.events add column if not exists attempts integer not null default 0;
alter table public.events add column if not exists error text;

-- Numbers that replied STOP: no more reminders or offers (booking messages still go).
create table if not exists public.message_optouts (
  phone  text primary key,                          -- 03xxxxxxxxx
  at     timestamptz not null default now(),
  via    text
);

-- The phone apps (stage 6) register here for push notifications.
create table if not exists public.push_tokens (
  token       text primary key,                     -- ExponentPushToken[…]
  owner_type  text not null check (owner_type in ('pro', 'customer')),
  owner_id    text not null,
  platform    text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists push_tokens_owner_idx on public.push_tokens (owner_type, owner_id);

alter table public.automation_rules enable row level security;
alter table public.message_optouts enable row level security;
alter table public.push_tokens enable row level security;
