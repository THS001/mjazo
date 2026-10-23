-- Live tracking: while a pro is on her way to a visit (and Mjazo Pro is open), her phone sends its
-- location about once a minute. Only the latest point is kept, only for that visit, and it is
-- deleted when she checks in (or the visit ends). The customer sees how far away she is; ops see
-- it on the board. Safe to run again.

create table if not exists public.visit_locations (
  booking_id  text primary key references public.bookings (id) on delete cascade,
  pro_id      text not null references public.pros (id),
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  at          timestamptz not null default now()
);

alter table public.visit_locations enable row level security;
