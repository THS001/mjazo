-- Mission control (platform stage 2): operations roles on the staff sign-in, refunds and credits
-- that a person approves, payout runs, the requests inbox and its state. Builds on 0005 (never
-- edit that file once it has run live). Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Staff roles. The CMS sign-in (cms_users, 0004) also carries the operations roles. A database
-- without the CMS tables (local PGlite, tests) skips this step.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.cms_users') is not null then
    alter table public.cms_users drop constraint if exists cms_users_role_check;
    alter table public.cms_users add constraint cms_users_role_check
      check (role in ('owner', 'admin', 'editor', 'author', 'seo', 'viewer', 'dispatcher', 'support', 'finance', 'recruiter'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Refunds and credits: someone asks, a person with the money permission approves, and only then
-- is anything posted to the ledger (entry_id).
-- ---------------------------------------------------------------------------

create table if not exists public.money_requests (
  id             text primary key,                    -- MR-…
  kind           text not null check (kind in ('refund', 'credit')),
  booking_id     text references public.bookings (id),
  customer_id    text not null references public.customers (id),
  amount         integer not null check (amount > 0),
  reason         text not null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by   text not null,                       -- staff email
  requested_at   timestamptz not null default now(),
  decided_by     text,
  decided_at     timestamptz,
  decision_note  text,
  reference      text,                                -- the refund's transfer reference
  entry_id       integer references public.journal_entries (id)
);
create index if not exists money_requests_status_idx on public.money_requests (status, requested_at desc);
create index if not exists money_requests_booking_idx on public.money_requests (booking_id);

-- ---------------------------------------------------------------------------
-- Payout runs: draft → approved → paid. Each run holds one payout per pro, with the balances
-- taken at the cut-off; paying one posts payoutSettled (lib/core/ledger.ts).
-- ---------------------------------------------------------------------------

create table if not exists public.payout_runs (
  id            text primary key,                     -- PR-…
  period_start  date not null,
  period_end    date not null,
  cut_off       timestamptz not null,
  status        text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  created_by    text not null,
  created_at    timestamptz not null default now(),
  approved_by   text,
  approved_at   timestamptz,
  cancelled_by  text,
  cancelled_at  timestamptz
);
create index if not exists payout_runs_created_idx on public.payout_runs (created_at desc);

alter table public.payouts add column if not exists run_id text references public.payout_runs (id);
alter table public.payouts add column if not exists netted integer not null default 0;
alter table public.payouts add column if not exists paid_by text;
alter table public.payouts add column if not exists entry_id integer references public.journal_entries (id);
create index if not exists payouts_run_idx on public.payouts (run_id);

-- A cancelled payout must not block drafting the same period again.
alter table public.payouts drop constraint if exists payouts_pro_id_period_start_period_end_key;
create unique index if not exists payouts_open_period_idx on public.payouts (pro_id, period_start, period_end) where status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- The requests inbox: Plus, gift card, referral, Home Pulse and other enquiries live in
-- `submissions`; this is how far the team has got with each.
-- ---------------------------------------------------------------------------

create table if not exists public.ops_requests (
  submission_id  text primary key,                    -- MJ-… (the website submission)
  status         text not null default 'new' check (status in ('new', 'contacted', 'done', 'declined')),
  note           text,
  handled_by     text,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Promo codes: who made or last changed each one.
-- ---------------------------------------------------------------------------

alter table public.promo_codes add column if not exists created_by text;
alter table public.promo_codes add column if not exists updated_by text;
alter table public.promo_codes add column if not exists updated_at timestamptz not null default now();

create index if not exists audit_log_actor_idx on public.audit_log (actor, at desc);

alter table public.money_requests enable row level security;
alter table public.payout_runs enable row level security;
alter table public.ops_requests enable row level security;
