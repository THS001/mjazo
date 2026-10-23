-- Phone-number sign-in: a customer types their number and gets a 6-digit code (WhatsApp, or SMS
-- through Twilio Verify); the code signs them in to the customer that number belongs to. Codes are
-- kept as a hash, live 10 minutes, take 5 tries and are used once. `session_epoch` ends every phone
-- sign-in of a customer when it goes up ("sign out on every device"). Safe to run again.

create table if not exists public.phone_codes (
  id          text primary key,                     -- PC-…
  phone       text not null,                        -- 03xxxxxxxxx
  channel     text not null,                        -- whatsapp | sms | test
  code_hash   text,                                 -- null for sms: Twilio Verify holds the code
  ip_hash     text,
  attempts    int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index if not exists phone_codes_phone_idx on public.phone_codes (phone, created_at desc);
create index if not exists phone_codes_ip_idx on public.phone_codes (ip_hash, created_at desc);
create index if not exists phone_codes_created_idx on public.phone_codes (created_at);

alter table public.phone_codes enable row level security;

alter table public.customers add column if not exists session_epoch int not null default 0;
