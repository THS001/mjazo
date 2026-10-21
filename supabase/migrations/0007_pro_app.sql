-- The pro app (platform stage 3): job offers a pro accepts or declines. Mission control offers an
-- unassigned visit to one pro at a time; the offer closes when she answers, when ops withdraw it
-- (or assign the visit directly), or when it expires. Builds on 0005 and 0006 (never edit those
-- once they have run live). Safe to run more than once.

create table if not exists public.job_offers (
  id            text primary key,                     -- OF-…
  booking_id    text not null references public.bookings (id) on delete cascade,
  pro_id        text not null references public.pros (id),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'withdrawn')),
  offered_by    text not null,                        -- staff email
  offered_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  responded_at  timestamptz,
  reason        text                                  -- why she declined, or why it was withdrawn
);
-- One open offer per visit.
create unique index if not exists job_offers_open_idx on public.job_offers (booking_id) where status = 'pending';
create index if not exists job_offers_pro_idx on public.job_offers (pro_id, status, offered_at desc);

-- Pros sign in to the app by email too (optional): looked up without regard to case.
create index if not exists pros_email_lower_idx on public.pros (lower(email));

alter table public.job_offers enable row level security;
