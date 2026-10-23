-- Visit packs: the blueprint analysis's maintenance plan, the repeat engine for the pilot.
--
-- A customer prepays a few visits of one service or bundle (threading and a clean-up every four
-- weeks, an AC service each season) for less per visit. They ask for one; Finance takes the money
-- (JazzCash, Easypaisa, bank, Raast or cash) and activates it, and from then on each booking they
-- make with it is paid from the pack: the pack's price per visit, with the rest of the service's
-- price as a discount Mjazo funds (the pro still earns her share of the full price, as with Plus).
--
-- Money goes through the ledger: the pack's price is held as a liability ("Packs not yet used")
-- until each visit is done; an unused pack cancelled gives back its unused visits. A booking made
-- with a pack keeps the pack and what it paid; a cancelled booking's visit goes back to the pack.
-- Safe to run again.

create table if not exists public.customer_packs (
  id            text primary key,                      -- PK-…
  customer_id   text not null references public.customers (id),
  slug          text not null,                         -- the pack in the catalogue it was bought from
  name          text not null,
  item          jsonb not null,                        -- { name, category, service, options }: what each visit is
  visits        integer not null check (visits between 1 and 24),
  visit_price   integer not null check (visit_price > 0),
  list_price    integer not null check (list_price >= 0),  -- the service's own price per visit when bought
  every_days    integer not null check (every_days between 1 and 365),
  valid_days    integer not null check (valid_days between 7 and 730),
  status        text not null default 'requested' check (status in ('requested', 'active', 'cancelled')),
  starts_at     timestamptz,
  ends_at       timestamptz,
  paid_via      text,
  reference     text,
  requested_at  timestamptz not null default now(),
  requested_by  text,
  activated_by  text,
  activated_at  timestamptz,
  cancelled_by  text,
  cancelled_at  timestamptz,
  refunded      integer,
  note          text
);
create index if not exists customer_packs_customer_idx on public.customer_packs (customer_id, status);

alter table public.bookings add column if not exists pack_id text references public.customer_packs (id);
alter table public.bookings add column if not exists pack_paid integer not null default 0;
create index if not exists bookings_pack_idx on public.bookings (pack_id) where pack_id is not null;

alter table public.customer_packs enable row level security;
