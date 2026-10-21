-- The client account (platform stage 4): customers sign in with an emailed link and see their
-- bookings live, change or cancel them within the policy, save addresses with a map pin, use promo
-- codes and their wallet credit at checkout, and rebook a pro they liked. Builds on 0005–0007
-- (never edit those once they have run live). Safe to run more than once.

-- A booking can ask for a particular pro ("book Sana again"), use some of the customer's credit
-- (taken from the ledger when the visit is done; the pro collects the rest), and come from a
-- saved address.
alter table public.bookings add column if not exists preferred_pro_id text references public.pros (id);
alter table public.bookings add column if not exists credit_used integer not null default 0;
alter table public.bookings add column if not exists address_id text references public.addresses (id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_credit_used_check') then
    alter table public.bookings add constraint bookings_credit_used_check check (credit_used >= 0 and credit_used <= total);
  end if;
end $$;

create index if not exists customers_email_lower_idx on public.customers (lower(email));
create index if not exists addresses_customer_idx on public.addresses (customer_id, created_at desc);
create index if not exists promo_redemptions_code_idx on public.promo_redemptions (code, customer_id);
