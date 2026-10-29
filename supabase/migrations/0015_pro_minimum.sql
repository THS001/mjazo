-- Pros' weekly minimum (the blueprint analysis, C6: a benefit only the platform gives).
--
-- When Finance switches it on (mission control → Money → Policies), a pro who kept herself
-- available and took her offers is paid at least the weekly minimum: Monday's payout run tops up
-- what she earned that week. The top-up is kept on her payout and posted to the ledger only when
-- the payout is paid (an expense, "Pro weekly minimum top-ups"), once per pro and week.
--
-- Her open windows are counted from what she had open during the week, not only what she has at
-- the end: each change to her weekly hours is logged (before and after), and so is a day off she
-- takes back on or after the day itself (that day still counts as off).
-- Safe to run again.

alter table public.payouts add column if not exists top_up integer not null default 0 check (top_up >= 0);

create table if not exists public.pro_availability_log (
  id      bigserial primary key,
  pro_id  text not null references public.pros (id) on delete cascade,
  at      timestamptz not null default now(),
  kind    text not null check (kind in ('hours', 'day_off_undone')),
  -- kind 'hours': her weekly hours before and after (weekday → windows; null: every window, every day)
  hours_before jsonb,
  hours_after  jsonb,
  -- kind 'day_off_undone': the day off she took back
  day     date
);
create index if not exists pro_availability_log_pro_at_idx on public.pro_availability_log (pro_id, at);
alter table public.pro_availability_log enable row level security;
