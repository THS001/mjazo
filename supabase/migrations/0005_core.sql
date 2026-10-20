-- Core engine: customers, pros, bookings, the money ledger, payouts, promo codes and the event
-- outbox. Relational and transactional, unlike the JSON documents in ops_docs. The server reaches
-- these tables over a direct Postgres connection (DATABASE_URL); locally and in tests the same
-- SQL runs on PGlite (lib/core/db.ts). Safe to run more than once.

-- ---------------------------------------------------------------------------
-- People and places
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id            text primary key,                    -- C-…
  phone         text unique,                         -- 03xxxxxxxxx
  email         text unique,
  name          text not null default '',
  auth_user_id  uuid unique,                         -- Supabase sign-in, once they have an account
  lang          text not null default 'en',
  marketing_ok  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.zones (
  slug        text primary key,                      -- the catalogue area slug (dha, clifton, …)
  name        text not null,
  lat         double precision,
  lng         double precision,
  daily_cap   integer,                               -- optional: most visits a day in this zone
  updated_at  timestamptz not null default now()
);

create table if not exists public.addresses (
  id           text primary key,
  customer_id  text not null references public.customers (id) on delete cascade,
  label        text,
  zone         text not null,
  sub_area     text,
  line         text not null,
  landmark     text,
  lat          double precision,
  lng          double precision,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists addresses_customer_idx on public.addresses (customer_id);

-- ---------------------------------------------------------------------------
-- Pros
-- ---------------------------------------------------------------------------

create table if not exists public.pros (
  id               text primary key,                 -- P-…
  name             text not null,
  phone            text not null unique,
  email            text unique,
  auth_user_id     uuid unique,
  home_zone        text not null,
  zones            text[] not null default '{}',     -- extra zones she will travel to
  skills           text[] not null default '{}',     -- category slugs
  women            boolean not null default true,
  status           text not null default 'active' check (status in ('active', 'paused', 'offboarded')),
  pin_hash         text,
  application_id   text,
  commission_rate  numeric(5, 4) not null default 0.25 check (commission_rate >= 0 and commission_rate <= 0.5),
  daily_cap        integer not null default 5,
  verification     jsonb not null default '{}'::jsonb, -- checklist: who checked what, when (never a CNIC image)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Weekly availability: the arrival windows she works on each weekday (0 = Sunday).
create table if not exists public.pro_availability (
  pro_id   text not null references public.pros (id) on delete cascade,
  weekday  smallint not null check (weekday between 0 and 6),
  windows  text[] not null default '{}',
  primary key (pro_id, weekday)
);

create table if not exists public.pro_time_off (
  pro_id  text not null references public.pros (id) on delete cascade,
  day     date not null,
  note    text,
  primary key (pro_id, day)
);

-- ---------------------------------------------------------------------------
-- Bookings (one booking = one visit = one ops job)
-- ---------------------------------------------------------------------------

create table if not exists public.bookings (
  id              text primary key,                  -- MJ-… (same id as the website submission)
  customer_id     text references public.customers (id),
  name            text not null,                     -- as given for this booking
  phone           text not null,
  zone            text not null,
  sub_area        text,
  address         text not null,
  landmark        text,
  lat             double precision,
  lng             double precision,
  day             date not null,
  arrival_window  text not null,                     -- a label from lib/time.ts WINDOW_LABELS
  status          text not null default 'new' check (status in ('new', 'assigned', 'en_route', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show')),
  pro_id          text references public.pros (id),
  route_order     integer,
  eta             text,
  subtotal        integer not null check (subtotal >= 0),
  discount        integer not null default 0 check (discount >= 0),
  total           integer not null check (total >= 0),
  client_total    integer,                           -- what the browser showed, kept for checking
  payment_method  text not null,
  promo_code      text,
  notes           text,
  channel         text not null default 'web',
  brief           jsonb,                             -- Ghar Scan / Look Card brief for the pro
  wedding         jsonb,                             -- Shaadi Orchestrator track
  visit_notes     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists bookings_day_idx on public.bookings (day);
create index if not exists bookings_pro_day_idx on public.bookings (pro_id, day);
create index if not exists bookings_customer_idx on public.bookings (customer_id, day desc);
create index if not exists bookings_status_idx on public.bookings (status, day);

create table if not exists public.booking_items (
  booking_id  text not null references public.bookings (id) on delete cascade,
  position    integer not null,
  name        text not null,
  category    text not null,
  service     text not null,
  options     jsonb not null default '[]'::jsonb,
  add_ons     jsonb not null default '[]'::jsonb,
  qty         integer not null check (qty between 1 and 20),
  unit_price  integer not null check (unit_price >= 0),
  duration    integer not null default 0,           -- minutes, per unit
  primary key (booking_id, position)
);

create table if not exists public.booking_events (
  id          integer generated always as identity primary key,
  booking_id  text not null references public.bookings (id) on delete cascade,
  type        text not null,
  at          timestamptz not null default now(),
  by          text not null,                        -- ops | pro | system | customer
  actor       text,                                 -- who exactly (staff email, pro id)
  note        text,
  lat         double precision,
  lng         double precision
);
create index if not exists booking_events_booking_idx on public.booking_events (booking_id, id);

-- What the pro recorded at the end of the visit (cash, or a digital payment with its screenshot).
create table if not exists public.booking_payments (
  booking_id  text primary key references public.bookings (id) on delete cascade,
  amount      integer not null,
  method      text not null check (method in ('cash', 'jazzcash', 'easypaisa', 'raast')),
  at          timestamptz not null,
  screenshot  text,
  ocr         jsonb,
  status      text not null check (status in ('cash', 'matched', 'mismatch', 'unreadable', 'pending')),
  checked     boolean not null default false,
  note        text
);

create table if not exists public.booking_ratings (
  booking_id  text primary key references public.bookings (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  tags        text[] not null default '{}',
  comment     text,
  at          timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Money: a double-entry ledger. Every amount is whole PKR. A posting's amount is positive for a
-- debit and negative for a credit; every journal entry must sum to zero (checked at commit).
-- Balances are only ever read from postings, never stored.
-- ---------------------------------------------------------------------------

create table if not exists public.ledger_accounts (
  id          text primary key,                     -- e.g. pro:P-1:cash, cust:C-1:ar, mjazo:commission
  kind        text not null check (kind in ('asset', 'liability', 'revenue', 'expense')),
  owner_type  text check (owner_type in ('pro', 'customer', 'mjazo')),
  owner_id    text,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id               integer generated always as identity primary key,
  at               timestamptz not null default now(),
  kind             text not null,                   -- visit_completed, cash_collected, payout, …
  booking_id       text references public.bookings (id),
  pro_id           text references public.pros (id),
  customer_id      text references public.customers (id),
  memo             text,
  actor            text,
  idempotency_key  text unique                      -- the same business event is never posted twice
);
create index if not exists journal_entries_booking_idx on public.journal_entries (booking_id);
create index if not exists journal_entries_pro_idx on public.journal_entries (pro_id, at);

create table if not exists public.postings (
  id          integer generated always as identity primary key,
  entry_id    integer not null references public.journal_entries (id),
  account_id  text not null references public.ledger_accounts (id),
  amount      integer not null check (amount <> 0)
);
create index if not exists postings_account_idx on public.postings (account_id);
create index if not exists postings_entry_idx on public.postings (entry_id);

create or replace function public.ledger_check_balanced() returns trigger language plpgsql as $$
declare
  total bigint;
  n integer;
begin
  select coalesce(sum(amount), 0), count(*) into total, n from public.postings where entry_id = new.entry_id;
  if n < 2 or total <> 0 then
    raise exception 'Journal entry % does not balance (% postings, sum %)', new.entry_id, n, total;
  end if;
  return null;
end $$;

drop trigger if exists postings_balanced on public.postings;
create constraint trigger postings_balanced after insert on public.postings
  deferrable initially deferred for each row execute function public.ledger_check_balanced();

-- The ledger is append-only: corrections are new entries, never edits.
create or replace function public.ledger_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'The ledger is append-only: post a correcting entry instead';
end $$;

drop trigger if exists postings_append_only on public.postings;
create trigger postings_append_only before update or delete on public.postings
  for each row execute function public.ledger_append_only();
drop trigger if exists journal_entries_append_only on public.journal_entries;
create trigger journal_entries_append_only before update or delete on public.journal_entries
  for each row execute function public.ledger_append_only();

create table if not exists public.payouts (
  id            text primary key,                   -- PO-…
  pro_id        text not null references public.pros (id),
  period_start  date not null,
  period_end    date not null,
  earned        integer not null,                   -- payable before netting
  cash_held     integer not null,                   -- cash she holds for Mjazo, netted off
  amount        integer not null,                   -- > 0: Mjazo pays her; < 0: she hands in cash
  status        text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  reference     text,                               -- bank / JazzCash transfer reference
  created_at    timestamptz not null default now(),
  approved_by   text,
  approved_at   timestamptz,
  paid_at       timestamptz,
  unique (pro_id, period_start, period_end)
);

create table if not exists public.promo_codes (
  code          text primary key,                   -- upper case
  kind          text not null check (kind in ('percent', 'fixed')),
  value         integer not null check (value > 0),
  min_order     integer not null default 0,
  max_discount  integer,
  max_uses      integer,
  per_customer  integer not null default 1,
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean not null default true,
  note          text,
  created_at    timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  code         text not null references public.promo_codes (code),
  booking_id   text primary key references public.bookings (id) on delete cascade,
  customer_id  text references public.customers (id),
  amount       integer not null,
  at           timestamptz not null default now()
);
create index if not exists promo_redemptions_code_idx on public.promo_redemptions (code, customer_id);

-- ---------------------------------------------------------------------------
-- Plumbing: the event outbox (automations read it), outgoing messages, and the audit log
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id            integer generated always as identity primary key,
  at            timestamptz not null default now(),
  type          text not null,                      -- booking.created, booking.assigned, …
  booking_id    text,
  pro_id        text,
  customer_id   text,
  data          jsonb not null default '{}'::jsonb,
  processed_at  timestamptz
);
create index if not exists events_pending_idx on public.events (id) where processed_at is null;

create table if not exists public.notifications (
  id          integer generated always as identity primary key,
  event_id    integer references public.events (id),
  channel     text not null check (channel in ('whatsapp', 'sms', 'email', 'push', 'log')),
  recipient   text not null,
  template    text not null,
  body        text not null,
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'logged', 'skipped')),
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists notifications_queued_idx on public.notifications (id) where status = 'queued';

-- One-off markers, e.g. that the older ops records were copied into these tables.
create table if not exists public.core_meta (
  key    text primary key,
  value  jsonb not null default '{}'::jsonb,
  at     timestamptz not null default now()
);

create table if not exists public.audit_log (
  id      integer generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text not null,                            -- staff email, pro id, "system", "customer"
  action  text not null,
  target  text,
  detail  jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

-- Server-only, like every other table: row-level security on, no policies.
alter table public.customers enable row level security;
alter table public.zones enable row level security;
alter table public.addresses enable row level security;
alter table public.pros enable row level security;
alter table public.pro_availability enable row level security;
alter table public.pro_time_off enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_payments enable row level security;
alter table public.booking_ratings enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.postings enable row level security;
alter table public.payouts enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.core_meta enable row level security;
