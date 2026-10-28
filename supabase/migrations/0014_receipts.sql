-- Receipts and sales tax (the blueprint analysis, C7).
--
-- Sindh sales tax as Mjazo charges it: off until Finance sets a rate and a start day in mission
-- control → Money → Policies (kept in core_meta). Every booking made from that day carries its
-- tax, frozen on the booking: the amount, the rate, whether it's inside the listed price (Mjazo
-- bears it) or added on top (the customer pays it), and its base (the whole booking, or only
-- Mjazo's share). In the ledger it's owed to the Sindh Revenue Board ("mjazo:salestax").
--
-- A receipt is issued when a visit is done: a gapless number (MJR-000001, from a locked counter)
-- and a frozen copy of what was charged. Refunds are shown under it from the ledger.
-- Safe to run again.

alter table public.bookings add column if not exists tax integer not null default 0 check (tax >= 0);
alter table public.bookings add column if not exists tax_rate numeric(5, 4) check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 0.25));
alter table public.bookings add column if not exists tax_inclusive boolean;
alter table public.bookings add column if not exists tax_base text check (tax_base is null or tax_base in ('total', 'commission'));

create table if not exists public.receipt_counter (
  id    integer primary key default 1 check (id = 1),
  last  bigint not null default 0
);
insert into public.receipt_counter (id, last) values (1, 0) on conflict (id) do nothing;

create table if not exists public.receipts (
  no           bigint primary key,
  booking_id   text not null unique references public.bookings (id),
  customer_id  text references public.customers (id),
  issued_at    timestamptz not null default now(),
  total        integer not null,
  tax          integer not null default 0,
  data         jsonb not null                          -- the frozen copy: lines, discounts, tax, credit, pack
);
create index if not exists receipts_issued_idx on public.receipts (issued_at);
create index if not exists receipts_customer_idx on public.receipts (customer_id);

alter table public.receipt_counter enable row level security;
alter table public.receipts enable row level security;
