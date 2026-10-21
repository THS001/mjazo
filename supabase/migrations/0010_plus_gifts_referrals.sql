-- Platform: Mjazo Plus, gift cards and referral rewards made real (they were request forms).
--
-- - Plus: a customer asks to join; ops mark the fee paid, which starts a year of the Plus discount
--   on every booking (the larger of Plus, a promo code or a friend's referral; never two).
-- - Gift cards: ops issue a code once the buyer has paid; whoever has the code turns it into Mjazo
--   credit in their account (once).
-- - Referrals: every customer with a number can have a code; a friend's first booking with it gets
--   the friend discount, and when that visit is done the referrer gets credit (once per friend).
--
-- Money goes through the ledger: Plus fees are revenue, unredeemed gift cards a liability, referral
-- rewards an expense. Safe to run again.

alter table public.customers add column if not exists referral_code text;
create unique index if not exists customers_referral_code_idx on public.customers (referral_code) where referral_code is not null;
alter table public.customers add column if not exists referred_by text references public.customers (id);

create table if not exists public.plus_memberships (
  id            text primary key,                      -- PL-…
  customer_id   text not null references public.customers (id),
  status        text not null default 'requested' check (status in ('requested', 'active', 'cancelled')),
  price         integer not null check (price >= 0),
  discount_pct  integer not null check (discount_pct between 0 and 50),
  starts_at     timestamptz,
  ends_at       timestamptz,
  paid_via      text,
  reference     text,
  requested_at  timestamptz not null default now(),
  requested_by  text,
  activated_by  text,
  activated_at  timestamptz,
  note          text
);
create index if not exists plus_memberships_customer_idx on public.plus_memberships (customer_id, status);

create table if not exists public.gift_cards (
  code             text primary key,                   -- MJG-XXXX-XXXX
  amount           integer not null check (amount > 0),
  status           text not null default 'active' check (status in ('active', 'redeemed', 'cancelled')),
  buyer_name       text,
  buyer_phone      text,
  recipient_name   text,
  recipient_phone  text,
  message          text,
  paid_via         text,
  reference        text,
  created_by       text not null,
  created_at       timestamptz not null default now(),
  redeemed_by      text references public.customers (id),
  redeemed_at      timestamptz,
  cancelled_by     text,
  cancelled_at     timestamptz
);
create index if not exists gift_cards_status_idx on public.gift_cards (status, created_at desc);

create table if not exists public.referral_rewards (
  friend_customer_id    text primary key references public.customers (id),
  referrer_customer_id  text not null references public.customers (id),
  booking_id            text not null,
  amount                integer not null check (amount > 0),
  at                    timestamptz not null default now()
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_customer_id);

alter table public.plus_memberships enable row level security;
alter table public.gift_cards enable row level security;
alter table public.referral_rewards enable row level security;
