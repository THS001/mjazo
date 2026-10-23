# Mjazo: project progress

_Last updated 23 October 2026 (after the platform, part 3: phone-number sign-in)._

- **Live site:** https://mjazo.vercel.app
- **Code:** https://github.com/THS001/mjazo (branch `main`)
- **Detailed CMS status:** [docs/CMS-STATUS.md](docs/CMS-STATUS.md)

Mjazo is a home-services company for Karachi: salon and beauty at home, cleaning, pest control, AC
and appliances, repairs, health visits, care and moving. Customers book online and a verified pro
comes to them. This file records everything built so far, what's live, what needs the owner's
accounts, and what's left.

---

## At a glance

| Area | Status |
|---|---|
| Public website (v2) | Built and live at mjazo.vercel.app |
| Booking flow (cart, checkout, confirmation, account) | Built and live; bookings confirmed on WhatsApp |
| Brand kit (guidelines PDF, logos) | Done |
| AI features (Concierge, Ghar Scan, Home Pulse, Glam Mirror, Shaadi Orchestrator) | Built and live; verified with the real API key |
| Staff tools (`/ops` console, `/pro` app, recruiting interviews) | Built and live. `/ops` becomes mission control with stage 2 (below); `/pro` stays off until `SESSION_SECRET` is set |
| CMS phase 1: foundation | Done, live |
| CMS phase 2: every page editable | Done, live |
| CMS phase 3: media library | Done, live |
| CMS phase 4: Urdu site | Done, live (the Urdu site stays hidden until switched on) |
| CMS phase 5: SEO | Done, live |
| CMS phase 6: page builder and live preview | Done, live |
| CMS phase 7: hardening and team handbook | Done, live |
| Interface text phase 2 (tools, chat, account, offers, ratings, hero phone, pro pages) | **Done and live 19 Oct 2026**, with Urdu |
| Supabase (database and file storage) | **Connected (5 Oct 2026).** CMS content, media, bookings and staff data are now stored durably |
| **Platform stage 1: core engine** (bookings, pros, money ledger, slot capacity) | **Live 21 Oct 2026**: migration 0005 run on Supabase, `DATABASE_URL` set, deployed and checked |
| **Platform stage 2: mission control** (staff accounts and roles, booking page, money approvals, payout runs, promo codes, KPIs, audit log) | **Live 21 Oct 2026** (section 3c): migration 0006 run on Supabase, deployed and checked. Next: give the team their roles in `/admin/people` |
| **Platform stage 3: the pro app** (versioned `/api/v1/pro` API, job offers, schedule, earnings from the ledger, payouts, ratings, availability, email sign-in) | **Live 21 Oct 2026** (section 3d): migration 0007 run, `SESSION_SECRET` set, deployed and checked. Next: PINs (and emails) for the real pros in mission control |
| **Platform stage 4: the client account** (email sign-in, live bookings, change and cancel, saved addresses with a map pin, promo codes, wallet credit, book a pro again, `/api/v1/customer`) | **Live 21 Oct 2026** (section 3e): migration 0008 run, deployed and checked. Still to do: Supabase sign-in settings and SMTP (section 7, item 9), then a real email sign-in |
| **Platform stage 5: automation** (customer messages, auto-assign, weekly payout drafts, opt-in Home Pulse and win-back messages, mission control → Automations) | **Live 21 Oct 2026** (section 3f): migration 0009 run, deployed and checked. Messages stay in test mode (logged only) until WhatsApp templates or Resend are set; the automation pinger needs `CRON_SECRET` (section 7, item 10) |
| **After the platform, part 1: Plus, gift cards and referral rewards** (they were request forms) | **Built 21 Oct 2026** (section 3h). To go live: `--migrate` (0010), then deploy |
| **After the platform, part 2: live tracking of the pro** (the customer sees how far away she is, ops see it on the board) | **Built 23 Oct 2026** (section 3h). To go live: `--migrate` (0011), then deploy |
| **After the platform, part 3: phone-number sign-in** (a 6-digit code on WhatsApp or by SMS, website and app) | **Built 23 Oct 2026** (section 3h). To go live: `--migrate` (0012), deploy, then a WhatsApp authentication template or Twilio Verify (section 7, item 13) |
| **Platform stage 6: the phone apps** (Mjazo and Mjazo Pro, Expo, in `mobile/`) | **Built 21 Oct 2026** (section 3g); its API is **live** (deployed the same day and checked). Next: try both apps on a phone with Expo Go, then store builds with your Expo account |

---

## Timeline

| Date | What happened |
|---|---|
| 7 Sep 2026 | Venture blueprint written (`MjazoVentureBlueprint.pdf`) |
| 1 Oct 2026 | Blueprint analysis and website plan v1. The first website was built on a motocross-style template |
| 2 Oct 2026 | **The client rejected v1**, which was deleted; the plan and PDF were kept |
| 2 Oct 2026 | **Website plan v2:** the full Urban Company / Justlife-style catalogue on the "Homie" template. v2 was built and deployed to mjazo.vercel.app |
| 2 Oct 2026 | Brand kit built: guidelines PDF, logos, one saffron colour, the tagline "Ghar ka har kaam. Pakka." |
| 2 Oct 2026 | **AI roadmap phases 1 to 3** built and deployed. The Anthropic key was added to Vercel and the AI features were verified on the live site |
| 3 Oct 2026 | CMS plan approved (7 phases). **CMS phase 1 deployed.** Phase 2 started |
| 4 Oct 2026 | CMS phase 2 finished, phases 3 and 4 done, phase 5 well under way. A git repository was created and the code pushed to GitHub |
| 5 Oct 2026 | **CMS phase 5 finished:** SEO dashboard, redirects screen, SEO previews in the editor, weekly SEO check, plus tests |
| 5 Oct 2026 | **CMS phase 6 finished:** block pages from 13 blocks, live preview beside every editor, click-to-edit. Also fixed new items returning 404 after a deploy |
| 5 Oct 2026 | **Supabase connected and phases 2 to 7 deployed.** The owner ran `scripts/setup-supabase.mjs`; both Owners can sign in, with two-step sign-in |
| 5 Oct 2026 | **CMS phase 7 finished:** permission matrix tests and fixes, backup and restore, two-step sign-in, history compare, a smaller page payload, and the team handbook PDF |
| 21 Oct 2026 | **Platform plan approved** (core + mission control first, real Expo apps, all four automations, email-link sign-in). **Stage 1, the core engine, built:** relational bookings and pros, a double-entry money ledger, server-side pricing and real slot capacity at checkout |
| 23 Oct 2026 | **Phone-number sign-in built** (after the platform, part 3): customers sign in on the website or in the app with their number and a code on WhatsApp or by SMS, and see every booking made with that number; "Sign out everywhere"; a code also proves a number when an emailed sign-in adds it |
| 23 Oct 2026 | **Live tracking of the pro built** (after the platform, part 2): while she's on her way with Mjazo Pro or `/pro` open, the customer sees how far away she is and about how long, and ops see it on the board. Only her latest point is kept, and it's deleted at check-in |
| 21 Oct 2026 | **Plus, gift cards and referral rewards built** (after the platform, part 1): they were request forms; now real memberships, gift card codes that become credit, and referral codes with automatic rewards, on the ledger |
| 21 Oct 2026 | **Stage 6, the phone apps, built:** Mjazo (browse, book with real free windows, promo codes and credit, follow bookings live, move or cancel, rate, book a pro again, addresses, English and Urdu) and Mjazo Pro (phone + PIN, today and coming days, offers, On my way → check in → finish with the payment, SOS, earnings, ratings, availability, English, Urdu and Roman Urdu), on one shared package. New API: `/api/v1/catalog`, `/api/v1/config`, `/api/v1/bookings` |
| 21 Oct 2026 | **Stage 5, automation, built and live** (migration 0009 run, deployed): booking confirmed, the day-before reminder, "on the way" and "rate your visit" messages (WhatsApp templates, email or a push, and only logged until a provider is set); auto-assign that suggests or offers each visit to the best verified pro; Monday's payout run drafted for Finance; opt-in Home Pulse and win-back messages with quiet hours, a monthly limit and STOP; mission control → Automations |
| 21 Oct 2026 | **Stage 4, the client account, built:** customers sign in with an emailed link and see their bookings live (steps, their pro's first name), move or cancel them within the free-change hours, save addresses with a map pin, use promo codes and their Mjazo credit at checkout, and book a pro they liked again. `/api/v1/customer` for the coming app. Deployed and migration 0008 run the same day |
| 21 Oct 2026 | **Stage 3, the pro app, built:** the `/api/v1/pro` API the phone app will use, job offers pros accept or decline, a week's schedule, earnings and payouts from the ledger, ratings, pros setting their own availability, and email sign-in next to phone + PIN. `/pro` rebuilt on it. Migration 0007 run, `SESSION_SECRET` set and **deployed the same day** |
| 21 Oct 2026 | **Stage 1 live** (migration 0005 run, `DATABASE_URL` set, deployed). **Stage 2, mission control, built:** per-person staff sign-in with Dispatcher, Support, Finance and Recruiter roles, every action in an audit log, money moves approved by a second person, payout runs, promo codes and KPIs. Migration 0006 run and **deployed the same day** |
| 19 Oct 2026 | **Interface text phase 2:** the text inside Ghar Scan, Home Pulse, Glam Mirror, the Shaadi Orchestrator, the Concierge, account screens, offers, ratings, the hero phone and the pro pages is editable in `/admin`, with hand-written Urdu. The AI tools answer in Urdu on `/ur` |

---

## 1. The public website

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, framer-motion, and three.js through
React Three Fiber, with Playfair Display and Inter fonts. The look follows the "Homie" template in
monochrome, with one saffron accent (#F4A437).

### Catalogue

- **8 service worlds:** Beauty & Wellness, Cleaning, Pest Control, AC & Appliances, Repairs & Home, Health at Home, Care, and Moving & More.
- **22 categories, 132 services:** each with prices, durations, options and add-ons, inclusions, exclusions and FAQs.
- **8 Karachi areas** with their sub-areas: DHA, Clifton, PECHS, Bahadurabad, Gulshan, Jauhar, North Nazimabad and Bahria.
- **6 bundles,** including seasonal home packs.
- **Status flags:** every category and area can be live, waitlist or hidden. At the user's request, everything is live.

### Pages

| Group | Pages |
|---|---|
| Home | Hero with the coastal video, a rising phone running a real tappable mini Mjazo app, then the search bar. Also the worlds grid, most-booked services, how it works, a live safety tracker, the AI tools, bundles, areas, promises, FAQ and a final call to action |
| Services | `/services` (menu with a 3D world ring); world pages `/services/w/[world]` (3D object); category pages; service pages with an options and booking box |
| Local pages | `/karachi`, `/karachi/[area]` and 176 area-and-category pages (e.g. `/karachi/dha/womens-salon`) |
| Booking | `/cart`, `/checkout` (area, address, date, arrival window, contact, pay after the visit), `/booking/confirmed` (add to calendar, confirm on WhatsApp), `/account` (bookings, rebooking, saved details), `/login` |
| Offers | `/offers` (bundles), `/plus` (membership and savings calculator), `/gift-cards`, `/refer` |
| Company | `/about`, `/careers`, `/business`, `/how-it-works`, `/safety`, `/contact`, `/complaint`, `/rate` |
| Content | `/blog` and articles, `/help` and help topics, legal pages (`/terms`, `/privacy`, `/cancellation-refund`, `/pro-code-of-conduct`) |
| Pros | `/partner` (become a pro, in English, Urdu and Roman Urdu), `/partner/apply`, `/partner/interview/[token]` |
| AI tools | `/ghar-scan`, `/home-pulse`, `/glam-mirror`, `/weddings` and `/weddings/planner` |
| Other | `/app` (install as an app), `/search`, a 404 page, sitemap, robots, the app manifest and generated share images |

### How bookings work today

- **Cart and checkout run in the browser.** Bookings, waitlist sign-ups, enquiries and applications go to `/api/submit`.
- **Customers pay after the service:** cash, JazzCash, Easypaisa or Raast. Card payments, OTP login and app-store links were removed rather than shown as "coming soon".
- **Plus, gift cards and referrals** work as request flows that the team confirms on WhatsApp.
- **Without Supabase,** submissions on Vercel are only logged (Vercel → Logs). With `RESEND_API_KEY` set, they're also emailed to the ops address.

---

## 2. AI features (AI roadmap phases 1 to 3)

All of these use Claude through `ANTHROPIC_API_KEY`, which is set on Vercel and was verified live on
2 October. Without the key, each falls back gracefully (a WhatsApp hand-off, or rules only).

| Feature | What it does |
|---|---|
| **Mjazo Concierge** | Chat on every page (`/api/concierge`) and on WhatsApp (`/api/whatsapp`, which needs the `WHATSAPP_*` settings). Books by chat or voice in English, Urdu or Roman Urdu. Voice notes need `STT_API_KEY` |
| **Ghar Scan** | Photograph a problem or a look; it names the likely issue, the matching service and the price range. v2 adds follow-up questions, problem pins and a brief sent to the technician; brief photos are deleted when the visit ends |
| **Home Pulse** | A 90-day care calendar built around bookings, Karachi's seasons, the weather forecast, Eid and family events |
| **Glam Mirror** | Mehndi designs on a photo of your hand and live makeup try-on. Runs on the phone (MediaPipe) and saves a Look Card for the pro |
| **Shaadi Orchestrator** | Plans the whole family's wedding glam, working backwards from photo time. Scheduling is worked out in code; a coordinator approves it in the ops console |
| **Ratings and complaints** | `/rate` and `/complaint`, including voice-note complaints, feeding the Trust Desk |

**Gotcha:** `claude-sonnet-5-5` rejects a forced tool choice. All structured answers go through
`lib/ai/structured.ts`, so don't add direct forced tool calls.

---

## 3. Staff tools

Their data went to the Supabase table `ops_docs` (migration 0003); with the core engine on, jobs,
pros and money live in the core tables (3b). From stage 2, `/ops` is **mission control** (3c): no
shared passcode, each person signs in with their own email. The `/pro` app keeps phone + PIN and
needs `SESSION_SECRET`.

- **`/ops` console:**
  - a live board, and Route Brain for route planning
  - pros, and recruiting
  - the Trust Desk: today's digest, quality drift, leakage watch, activity log
  - wedding approvals, and Ask AI
- **`/pro` app:** today's jobs, an SOS button and an AI copilot.
- **Recruiting:** applicants get an AI interview link at `/partner/interview/[token]`.
- **Safety Guardian:** runs every 5 minutes through `/api/cron/safety`. It needs `CRON_SECRET` and an external pinger, because Vercel Hobby crons run only daily.

**Placeholders:** the pro share of 75% (`lib/ops/logic.ts`) and a generic protocol manual (`lib/ops/protocols.ts`).

---

## 3b. The core engine (platform stage 1)

The blueprint's "one backend, one database" (`MjazoVentureBlueprint.pdf` §11). Code in `lib/core/`, tables in `supabase/migrations/0005_core.sql`.

- **Tables:**
  - **People and places:** customers, addresses, zones.
  - **Pros:** pros (skills, zones, commission rate, daily cap, verification checklist), weekly availability, time off.
  - **Bookings:** bookings, booking lines, the event history, the pro's pay sheet, ratings.
  - **Money:** the **ledger** (accounts, journal entries, postings), payouts, promo codes and their redemptions.
  - **Plumbing:** an event outbox for the automations, outgoing notifications, an audit log.
- **One database layer** (`lib/core/db.ts`): Postgres through `pg` on Supabase's transaction pooler (`DATABASE_URL`) in production; **PGlite** (an embedded Postgres in `.data/pglite`) locally and in tests, running the same SQL. Without `DATABASE_URL` in production the core is off and everything works as before.
- **Bookings are priced on the server** from the catalogue (`lib/core/pricing.ts`): prices sent by the browser are ignored, and lines that can't be booked are refused. The referral discount is applied on the server too (first booking from a phone number only). Each booking is linked to a customer by phone.
- **Real slot capacity** (`lib/core/capacity.ts`, `POST /api/v1/slots`). A window is open only if Route Brain can still fit the booking without dropping one that already fits.
  - Checkout shows full windows and full days, and re-checks when the booking is placed.
  - Categories with no pros yet stay open for the team to confirm.
- **The money ledger** (`lib/core/ledger.ts`). Double-entry, whole rupees, append-only; the database refuses an entry that doesn't balance or any edit. Entries are posted automatically:
  - a completed visit: the customer owes the total, the pro earns her share of the full price, Mjazo funds any discount;
  - cash collected (held by the pro) or a digital payment (Mjazo's account) once it's cash, matched or checked;
  - cash handed in, payout settlement (cash held is netted against what she's owed), credits, refunds.
  - Cash held per pro and the amount payable are read straight from it. The pro app's 7-day earnings now come from the ledger.
- **The ops console and pro app run on it unchanged** (`lib/core/jobs.ts` returns the same job and pro shapes). Changes lock the row, write only what changed, and keep the history append-only.
  - The first use copies any older `ops_docs` pros and jobs across, once.
  - Booking submissions that didn't reach the core are imported on the next ops read.
- **Tests:** 37 engine tests on PGlite cover ledger balance and guards, every money flow, a random run of 25 bookings, pricing, the status machine, capacity, referral, and imports.
- **Checked locally (dev server, staff tools on with local test values):**
  - A booking sent with a tampered PKR 100 price was stored at the real PKR 6,100.
  - The pro's only slot showed as full at checkout.
  - Assign → pro PIN sign-in → on the way → check-in → finish with cash: the pro app showed PKR 4,575 earned (75%), and the ops board showed the booking done.

## 3c. Mission control (platform stage 2)

Built on 21 October 2026 on top of the core engine, checked locally, and **live the same day** (migration 0006 run, deployed). Schema
changes are in `supabase/migrations/0006_mission_control.sql` (safe to run again).

- **Staff accounts.** The shared `OPS_PASSCODE` is gone. Everyone signs in to `/ops` with their own email on the CMS sign-in (Supabase + `cms_users`), so every action carries a name.
  - New roles beside the CMS ones: **Dispatcher, Support, Finance, Recruiter**, given in `/admin/people`. Only an Owner can make someone an Owner or Finance.
  - What each role may do is in `lib/ops/access.ts` and is checked on the server for every `/api/ops` action (`requireStaff()` in `lib/server/staff.ts`). The console hides what a role can't use.
  - **Two-step sign-in is required for Owners, Admins and Finance** (the CMS's authenticator-app codes).
  - Locally without Supabase, the sign-in screen offers "Continue as local …" for any role. This is refused in production.
- **Audit log.** Every staff action is written to the core `audit_log` table with the person's email. Money actions write theirs inside the same transaction as the money move. The Audit log tab can't edit or delete anything.
- **Screens** (the existing console, grown):
  - **Requests inbox:** Plus, gift card, referral, Home Pulse and other enquiries from `submissions`, with a status (new, contacted, done, declined) and a note.
  - **Board + booking page:** customer, services, payment and the booking's ledger entries, timeline, notes, reschedule (with a capacity check), cancel, and refunds and credits.
  - **Pros:** the verification checklist (6 checks; the CNIC is looked at in person and only who, when and its last 4 digits are kept), zones, daily cap, weekly windows and days off. Zones have daily caps too.
  - **Money:** cash each pro holds and what she's owed (from the ledger), refunds and credits waiting for approval, payments to reconcile, cash handed in, and **payout runs** (draft → approved → paid with a reference, settled in the ledger).
  - **Promo codes:** create, edit, switch on or off. Checkout starts taking them with the client account (stage 4).
  - **KPIs:** bookings, completion rate, GMV, repeat rate, visits per pro-day and unreconciled cash, for 7, 30 or 90 days.
- **A second person approves every money move.** Support asks for a refund or credit; someone with the money permission approves it, and only then is it posted to the ledger. Whoever asked for a refund or credit, or drafted a payout run, can't approve it themselves (Owners may, for a small team).
- **Tests:** 322 in total (up from 240). New: the role matrix, a permission test for every `/api/ops` action, payout runs and refunds through the ledger, the verification checklist and limits.
- **Checked in the browser** (dev server, a local person per role):
  - Owner adds and checks a pro; Dispatcher assigns; the pro checks in and finishes with cash; cash held shows.
  - Finance drafts a payout run, the Owner approves it, Finance marks both payouts collected with receipt numbers: cash held and owed both PKR 0, and the books balance.
  - Support asks for a PKR 500 credit (the server refuses Support's own approval); Finance approves it; the ledger posts goodwill against the customer's credit and still balances.
  - The audit log shows each step with the person's email; the KPIs read the live data.
- **Checked live after the deploy:** `/ops` asks for a Mjazo email; the local test sign-in is refused (404); every `/api/ops` screen answers 401 when signed out; slot capacity reads the core database through the new `DATABASE_URL`.

## 3d. The pro app (platform stage 3)

Built on 21 October 2026, checked locally, and **live the same day** (migration 0007 run, `SESSION_SECRET` set, deployed). Schema change:
`supabase/migrations/0007_pro_app.sql` (job offers).

- **One API for the web and the phone app:** `/api/v1/pro/*`. The Expo app (stage 6) uses it unchanged. Every route is in `app/api/v1/pro/`; the logic is in `lib/server/pro-api.ts`.

  | Route | What it does |
  |---|---|
  | `POST/DELETE session` | Sign in with phone + PIN: a token for the phone app, and the same session as a cookie for the web. `DELETE` signs the web app out |
  | `POST session/email` | Email sign-in, step 1 (then Supabase emails the link) |
  | `GET me` | Her profile: areas, skills, verification, rating |
  | `GET jobs?days=7` | Her visits from today, by day, with today's safety prompts, her week's earnings and how many offers are waiting |
  | `POST jobs/{id}` | On my way, check in, I'm safe, check out, a note for next time, or finish with the payment (cash, or a screenshot that AI reads) |
  | `GET offers`, `POST offers/{id}` | Offers waiting for her, and accept or decline (with a reason) |
  | `GET earnings` | What Mjazo owes her, the cash she holds, the next payout, this week and the last 30 days, her ledger statement and her payouts |
  | `GET ratings` | Average, the spread of stars, and recent ratings (no customer names) |
  | `GET/PUT availability` | Her weekly windows and days off |
  | `POST sos`, `POST copilot` | SOS (on a visit or between visits) and the AI Copilot |

- **Sign-in** (`lib/server/pro-auth.ts`): phone + PIN, kept as planned, plus an optional emailed link for pros whose email ops have saved in mission control.
  - The phone app sends `Authorization: Bearer mjp.…` (the PIN token) or its Supabase access token. The web app keeps the same signed session in a cookie.
  - Every request reads the pro again: **resetting her PIN ends every PIN session**, and a paused pro is refused.
  - A pro's Supabase account gives no access to `/admin` or `/ops` (that needs a `cms_users` role).
- **Job offers** (`lib/core/offers.ts`). On the board or the booking page, the "Assign or offer…" menu can offer an unassigned visit to one pro.
  - She sees the area, services, time and what she'd earn, **but not the customer's name, phone or address until she accepts**.
  - Accepting assigns the visit to her. Declining leaves it unassigned with her reason on the timeline.
  - An offer closes after 2 hours, or 1 hour before the arrival window. Ops can withdraw it, and assigning directly, rescheduling or cancelling withdraws it too.
  - She can't take a visit on her day off, in a window where she already has a visit, or beyond her daily cap.
- **Availability:** she sets her own weekly windows and days off. A day off on a day she already has visits is refused ("ask ops"). Changes go to the audit log and the outbox.
- **`/pro` rebuilt on the API**, in English, Urdu and Roman Urdu, with five tabs: Today, Schedule (7 days), Offers (with a badge), Earnings and Profile (rating, availability, language). The old `/api/pro/*` routes are gone.
- **Copilot** can now only save notes on her own visits.
- **Tests:** 353 in total (up from 326). New: job offers on the database (13), and the API through its real routes (11: sign-in by PIN and Supabase token, PIN reset and pause, one pro never reaching another's visits or offers, an offer hiding who the customer is, a whole visit from offer to the ledger, availability, SOS).
- **Checked in the browser** (dev server, phone size):
  - A Dispatcher offered a visit to Sana from the board, which showed "Offered to Test Pro Sana · waiting until 9:39 am".
  - In `/pro` she saw the offer badge and the offer: PKR 3,375 to earn, no customer details. She accepted.
  - The visit appeared on Today with the customer's name and address. She ran it through: on the way, check in, finish with PKR 4,500 cash.
  - Earnings then showed Mjazo owes PKR 3,375 and she holds PKR 4,500, so she hands in PKR 1,125.
  - She edited her weekly windows. Urdu checked.
  - The booking's timeline, audit log and ledger in mission control recorded each step.
- **Checked live after the deploy:** `/pro` shows the sign-in with the email option; PIN sign-in answers (wrong PIN: 401, so the app is switched on); every `/api/v1/pro` screen answers 401 when signed out; the email link's first step answers the same for any email; the old `/api/pro` routes are gone.

## 3e. The client account (platform stage 4)

Built on 21 October 2026, checked locally, and **live the same day** (deployed; migration 0008 run). Schema change:
`supabase/migrations/0008_client_account.sql` (a booking's requested pro, credit used and saved address).

- **Sign-in** (`/login`): an emailed link (Supabase). Anyone can make an account.
  - The website and the coming phone app both call `/api/v1/customer` with the Supabase access token (`lib/server/customer-auth.ts`), so the API is the same for both.
  - Locally without Supabase, a test sign-in (any email) gives a signed `mjc.` token, refused anywhere else.
- **Joining the phone number.** After the first sign-in the customer adds their number, which brings in the bookings made with it (`lib/core/customers.ts`).
  - A number that already has bookings needs proof: a booking made on this device with that number (sent automatically), or a booking number from one of its confirmations. Otherwise anyone could type someone else's number and see their bookings and address.
  - A number already on another account is refused, and so is a second number for the same account (changing it is a WhatsApp job).
- **Bookings, live** (`/account/bookings`): upcoming and past visits with their steps (booked → pro assigned → on the way → arrived → done), the pro's first name and ETA, and what's paid from credit.
  - Online **change and cancel** run until the CMS's free-change hours before the window (3). Later, the page points to WhatsApp. A move re-checks capacity, and the pro they had becomes the one they asked for.
  - Past visits can be rated, reported, or **booked again**, with the same pro when she still works with Mjazo.
- **Saved addresses** (`/account/addresses`): up to 10, one default. Each has a map pin (Leaflet + OpenStreetMap, no API key): the pin stays in the middle and they move the map, or use their location.
  - The area is worked out from the pin (`lib/geo.ts`: the nearest area centre within 6 km). Pins outside the areas we cover are refused.
- **Checkout:**
  - signed-in customers get their name, number and default address filled in, can pick another saved address, and save a new one;
  - anyone can drop a map pin (it goes to the pro with the booking);
  - **promo codes** are checked as they're typed in (`/api/v1/customer/promo`), and the reason a code can't be used shows in English or Urdu;
  - one discount per booking: the larger of a friend's referral and the code;
  - **Mjazo credit** (signed in only) is set aside when they book and taken from the ledger when the visit is done, and the pro collects the rest;
  - **book her again** shows only that pro's free windows; if she can't do it, any pro is offered.
- **Mission control and the pro app:** the board and booking page show "Asked for …" (and that pro first in the picker), and the credit used. The pro app shows "The customer asked for you", and collects only what's due after credit.
- **Interface text:** the new "Customer account" group in `/admin` → Buttons & labels (91 texts, with Urdu). Existing texts weren't reworded, because a saved CMS copy would keep the old wording.
- **Tests:** 376 in total (up from 353). New: the core rules (12: proof, addresses and pins, promo codes and limits, credit through to the ledger) and the API through its real routes (11: sign-in, one customer never reaching another's bookings or addresses, booking with a promo code, credit and a requested pro, moving and cancelling, the free-change time, the requested pro's slots).
- **Checked in the browser** (dev server, the local test sign-in):
  - Signed in and added the number of an earlier test booking: it asked for proof, and the booking number joined it, bringing in two past visits and the PKR 500 credit from the stage 2 test.
  - Saved a "Home" address with its pin in DHA.
  - "Book Test again": checkout showed the saved address, the pro, the credit and the code WELCOME10. Total PKR 4,050, PKR 3,550 to pay after the visit.
  - Placed it: the account showed it live with "You asked for Test". Mission control showed "Asked for", the credit, the code and the pin.
  - Moved it to Friday, then cancelled it, and the credit was free again. Urdu checked.

## 3f. Automation (platform stage 5)

Built on 21 October 2026, checked locally, and **live the same day** (migration 0009 run, then deployed; signed-out calls to the new APIs and the cron route answer 401). Schema change: `supabase/migrations/0009_automation.sql` (the rules, the message log with one message per reason, STOP opt-outs, phone push tokens).

- **How it runs** (`lib/server/automation.ts`): every change in the core goes into the outbox (`events`). The automation works through it, then the timed rules, then sends what's queued.
  - It runs right after each booking or change, every 5 minutes from the pinger (`/api/cron/automation` with `CRON_SECRET`), once a day from Vercel's cron, while someone has the live board open, and from **Run now**.
  - Everything is safe to repeat: one message per reason (`dedupe_key`), one payout draft a week, events claimed with `skip locked`.
  - Events from before automation existed (or a long outage) are marked done without messaging anyone about the past: confirmations up to 6 hours old, "on the way" up to 1 hour, offers up to 2 hours.
- **Channels.** A message goes as a WhatsApp template when WhatsApp is set up and the rule has a template name; else by email (Resend) when the customer has an email; else a pro's offer goes as a push to the Mjazo Pro app (Expo) when she has it; else it's only **logged** ("test mode").
  - A failed send is tried 3 times. A phone that uninstalled the app has its push token dropped.
  - Phone apps register their push token with `POST /api/v1/pro/push-token` and `/api/v1/customer/push-token` (stage 6).
- **The messages** (editable in `/admin` → Settings → Customer messages, English and Urdu; the customer's language is the one they use the site in):
  - booking confirmed; the day-before reminder (from 6 pm); "your pro is on the way" (when she taps it, with her ETA); "rate your visit" (2 hours after, 10 am to 8 pm, up to 3 days, if not rated); a visit offered to a pro.
- **Auto-assign** (off / suggest / offer by itself; starts on "suggest"):
  - suggest: the live board shows the best pro for each unassigned visit and why (travel from her visit before or her home, her other visits that day, "asked for"), with an Offer button (`lib/ops/match.ts`);
  - offer by itself: the visit is offered to the best **verified** pro; if she declines or the offer runs out, the next; when nobody is left, ops get an email "Needs a pro". People can always assign by hand.
- **Weekly payout run:** Monday from 9 am, last week's (Monday to Sunday) run is drafted by "automation" and ops are emailed. Finance still approves it and marks each payout paid.
- **Opt-in messages** (both **off** until switched on in Automations):
  - Home Pulse reminders to people who asked for them on `/home-pulse`: what's due in the next 2 days;
  - win-back to signed-in customers who switched on "Reminders and offers on WhatsApp" on their account page, 60 and 90 days after their last visit if they haven't booked since;
  - both: 10 am to 8 pm only, at most 2 Home Pulse reminders a month, and never after **STOP**. A WhatsApp reply of STOP (or "unsubscribe") turns them off for that number; switching them back on in the account undoes it. Booking messages still go.
- **Mission control → Automations** (Owners and Admins, new permission `ops.automations`): each rule's switch, the auto-assign mode, the WhatsApp template name per message with its parameters in order, a preview of every message in English and Urdu, which channels are set up, the send log (filter by rule and status) and Run now. Every change is in the audit log.
- **Tests:** 400 in total (up from 376). New: automation on a real in-memory database (15: confirmations once each and in Urdu, nothing about old events, "on the way", the reminder and review request at their hours, the Monday payout draft once, Home Pulse limits and quiet hours, STOP by WhatsApp and opting back in, win-back only with consent, auto-assign through two declines to ops, pushes to the Pro app, WhatsApp templates and retries, previews), the pro ranking (3), and the new permission.
- **Checked in the browser** (dev server, local sign-ins):
  - Automations as an Owner: test-mode banner, the channels, 8 switches and auto-assign on "suggest", the English and Urdu previews; switching win-back on and off showed "Changed by" and both went into the audit log; Run now.
  - A checkout booking for that evening: its confirmation was in the send log within seconds. The live board showed "Suggested: Test Pro Hina · 15 min from her visit before · 1 other visit that day · not verified"; Offer sent it to her, and her offer message (with her PKR 3,375) was logged.
  - The account page's "Reminders and offers on WhatsApp" switch saved, in English and Urdu (right to left).

## 3g. The phone apps (platform stage 6)

Built on 21 October 2026; the API the apps use went **live** the same day (deployed; `/api/v1/catalog` and `/config` answer, an empty booking is refused, signed-out calls answer 401). Everything is in `mobile/` (its own npm workspace, kept out of the website's build, tests and Vercel upload); how to run it is in [mobile/README.md](mobile/README.md).

- **Two Expo apps (SDK 58, React Native 0.88, Expo Router) on one shared package** (`mobile/packages/shared`: the API client, sign-in, storage, design, languages, formatting, location and push):
  - **Mjazo** (`pk.mjazo.app`): the catalogue with search and popular services; each service's options and add-ons with the price the server will charge; the cart and the minimum order; checkout with a saved address or area, sub-area, street and "Use my location" (the area is worked out from it), the real free windows for that cart and area (and the pro they asked for), name and number, payment, notes, a promo code (in Urdu too) and their credit; the booking confirmation; bookings live (steps, the pro's first name, ETA, refreshed every 30 seconds during a visit), moving or cancelling within the free-change time, rating, booking a pro again; the account (adding the phone number with proof, credit, saved addresses, the WhatsApp messages switch, language, sign out). Guests can book; their bookings are kept on the phone and count as proof of the number later.
  - **Mjazo Pro** (`pk.mjazo.pro`): phone + PIN (or an emailed link); Today (visits in route order, safety prompts, the week's earnings, offers waiting, the coming days); offers to accept or decline with a reason; a visit's screen (customer, map, call, WhatsApp, services, notes, brief and photos, notes from earlier visits, On my way → check in → I'm safe → check out → finish with the payment, a screenshot for digital payments, which AI checks; a note for next time); SOS with her location; earnings and payouts from the ledger; ratings; weekly windows and days off. English, Urdu and Roman Urdu (the web pro app's texts).
  - Urdu screens read right to left. The apps' icons and splash screens come from the brand kit's house mark (Mjazo saffron, Mjazo Pro ink).
- **Location** is asked for only when it's used (Use my location, On my way, check in or out, finish, SOS) and never in the background. If the phone doesn't answer within 15 seconds, the action goes ahead without it.
- **Push notifications:** the installed apps register with `/api/v1/pro/push-token` and `/api/v1/customer/push-token`; the automation sends pros' offers, and now customers' booking messages too, as pushes when they have the app (else WhatsApp, email or the log as before). Pushes need the installed app and an Expo project (`eas init`); Expo Go can't receive them.
- **New API for the apps:** `GET /api/v1/catalog?lang=en|ur` (live categories, services with prices, options with a language-neutral key, add-ons, areas with their centres, windows, minimum order, policy, contact), `GET /api/v1/config` (Supabase's public address and key, whether email sign-in is on, contact) and `POST /api/v1/bookings` (the same checks and prices as the checkout, marked as an app booking; mission control shows an "App" badge).
- **Store builds:** `eas.json` in each app (preview APK, production AAB). They need the owner's Expo account, and a Google Play developer account to publish. `.easignore` keeps the website out of the upload.
- **Tests:** 403 in total (up from 400): the catalogue and app bookings through their real routes, and a customer's booking messages going to the app as a push. Both apps and the shared package type-check, and the customer app bundles for Android.
- **Checked in the browser** (both apps in web mode, against the local server, at phone size):
  - Mjazo: home (popular services, all eight sections), Women's Salon, Full body waxing with Rica and Face wax (PKR 6,100), the cart, local test sign-in, checkout (name and number filled in from the account, DHA Phase 6, Thursday 3–5 pm from the real windows, WELCOME10 for PKR 610 off) and booked: MJ-MVI2I3JBST7, PKR 5,490. Moved it to Friday 11 am–1 pm from the booking screen. Urdu, right to left.
  - Mjazo Pro (Test Pro Hina, PIN set in mission control): sign-in, Today, accepted an offer, On my way → check in → finished with PKR 4,500 cash; earnings showed she hands in PKR 1,125; changed and reset her weekly windows and a day off (the day she has a visit was blocked).
  - Mission control's send log had the app booking's confirmation, the offer to her and "on the way" to the customer.
- **Found and fixed on the way:** a development-only CORS setting in `next.config.mjs` made every `/api/v1` route with an id in its address answer 404 on the dev server; it was removed (the apps don't need CORS; `mobile/scripts/web-dev.mjs` serves an app and the API from one address for browser checks).

## 3h. After the platform: what was still missing

On 21 October 2026 the owner asked for the rest before testing: Plus, gift cards and referral rewards; live tracking of the pro; phone-number sign-in; and the AI tools in the apps. Built in that order, each in its own commit.

### Part 1: Plus, gift cards and referral rewards

Schema: `supabase/migrations/0010_plus_gifts_referrals.sql` (Plus memberships, gift cards, referral rewards; customers get a referral code and who referred them). Code: `lib/core/growth.ts`; three new ledger accounts: Plus fees (revenue), gift cards not yet used (a liability) and referral rewards (an expense).

- **Mjazo Plus** (PKR 2,500 a year for 10% off, from /admin → Settings → Plus & referrals):
  - a signed-in customer joins from the Plus page, the account page or the app; ops are emailed;
  - Finance or an Owner takes the fee (JazzCash, Easypaisa, bank, Raast or cash) and activates it in mission control → **Plus & gifts**, or adds a member by phone;
  - from then on every booking gets the member's discount for a year, by itself (an early renewal adds a year to the end). One discount per booking still: the largest of Plus, a promo code and a friend's referral;
  - the customer gets a "Welcome to Mjazo Plus" message (Automations; logged until WhatsApp or email is set).
- **Gift cards:** once the buyer has paid, mission control issues a code (`MJG-XXXX-XXXX`) with a ready message to WhatsApp the buyer or the recipient. Whoever has the code adds it in their account (website or app) and it becomes Mjazo credit, once. An unused card can be cancelled (its money goes back to the buyer outside the app). Tries are limited, so codes can't be guessed.
- **Referral rewards:**
  - every customer with a number has a code (`NAME-1234`), shown on their account (website and app) with WhatsApp sharing; the Refer page makes one from a name and number without signing in;
  - a friend's first booking with the code (from the `?ref=` link, or typed in the promo box on the website or in the app) gets PKR 500 off. **Only real codes count now, and never your own**: before, any code got the discount;
  - when that first visit is done, the referrer gets PKR 500 credit by itself (once per friend) and a message. Mission control lists the rewards paid.
- **Tests:** the growth core (5: Plus from request to discount and renewal, members added by phone, gift cards from sale to credit and cancelling, referral codes, the reward once), the API (2), the automation (2: the referral credit and message, the Plus welcome), the permissions, and the referral rules in the booking tests now use real codes.
- **Checked locally:** issued a PKR 1,500 gift card in mission control; the test customer joined Plus from the API, an Owner activated it (until 21 October 2027), the gift card became PKR 1,500 credit, a booking got 10% off by itself (PKR 450 off PKR 4,500), and the account page showed the membership, the credit, the code STAGE-0099 and the gift card box. The welcome message was logged.

### Part 2: live tracking of the pro

Schema: `supabase/migrations/0011_live_tracking.sql` (`visit_locations`: one row per visit, the latest point only). Code: `lib/core/tracking.ts`; the route `POST /api/v1/pro/jobs/{id}/location`.

- **While a pro is on her way** (she tapped "On my way") and Mjazo Pro is open on her phone, or `/pro` is open in her browser, her location goes to Mjazo about once a minute. It uses the permission she already gave for "On my way" (it never asks by itself) and never runs in the background. The app and `/pro` tell her so under the visit.
- **Only the latest point is kept, only for that visit,** and it's deleted as soon as the visit moves on (check-in, cancel, anything: `mutateJob()`). Further points are refused (409) and the app stops sending. A point older than 10 minutes isn't shown (her phone went quiet).
- **The customer** sees "Hina is about 8 min away (2.2 km)" and "See where she is" (Google Maps) on their bookings, on the website and in the Mjazo app, in English and Urdu. The minutes are a straight-line estimate for Karachi's roads (× 1.35 at 22 km/h) to their map pin, or to the area's centre without one.
- **Mission control:** each visit on the way shows "Live: 2.2 km away, about 8 min · seen at 8:34 am" on the live board, linking to the map.
- Until migration 0011 has run, tracking is simply off: nothing else fails because of it.
- **Tests:** 415 in total. The API test runs a visit through it: refused before "On my way", only the latest point kept, another pro refused, the customer's distance and minutes, the point deleted at check-in and further points refused.
- **Checked locally (23 Oct 2026):** a test pro on her way sent a point; the board showed it with the distance and minutes; a test customer's bookings page showed "Test is about 10 min away (2.6 km)" with the map link, and the Urdu page the same in Urdu; `/pro` showed the sharing notice under each visit on the way.

### Part 3: phone-number sign-in

Schema: `supabase/migrations/0012_phone_sign_in.sql` (`phone_codes`, and `customers.session_epoch`). Code: `lib/core/phone-sign-in.ts` (codes and their limits), `lib/server/phone-sign-in.ts` (sending, checking, the sign-in token), `/api/v1/customer/phone/code` and `/phone/session`.

- **Customers sign in with their number and a 6-digit code** on the website (`/login`, the "Phone number" tab, first when it's on) and in the Mjazo app. Email sign-in stays as the other tab.
  - The code goes **on WhatsApp** (an "Authentication" template in Meta with a copy-code button: `WHATSAPP_OTP_TEMPLATE`, plus the Cloud API settings) or **by SMS** through Twilio Verify (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`). With both, the customer picks; if WhatsApp fails, the screen says to try SMS. With neither, phone sign-in isn't offered on the live site; locally the code shows on the screen ("test mode").
  - Having the phone is the proof, so they're the customer that number belongs to, with **every booking made with it**, their credit, addresses, Plus and referral code (the same customer as an emailed sign-in that added that number). A number we haven't seen becomes a new customer, who is asked their name.
  - The sign-in lasts 90 days (a signed token, `SESSION_SECRET`). **"Sign out everywhere"** on the account (website and app) ends every phone sign-in of theirs, and the emailed sign-in's sessions everywhere.
- **Adding a number to an emailed sign-in:** a number that already has bookings can now be proven with a code sent to it ("Or get a code on this number instead"), as well as with a booking number.
- **Safety:** Pakistani mobile numbers only. Only the code's hash is kept; it lives 10 minutes, takes 5 tries and works once, and asking again stops the earlier one. A new code at most every 30 seconds, 5 an hour and 10 a day per number, 20 an hour from one internet address and 300 an hour for the whole site (so nobody can run up the SMS bill), kept in the database so they hold across Vercel's servers, plus per-address limits on the two routes. Codes older than two days are cleared.
- **Interface text:** 29 new texts in `/admin` → Buttons & labels → Customer account (with Urdu); the app's in `mobile/apps/customer/src/strings.ts`.
- **Tests:** 429 in total. New (14): sign-in with a code and the token on the account API, bookings made with the number brought in, wrong and used codes, other countries' numbers, the 30-second wait, forged tokens, sign out everywhere, the code limits (per number, per hour and day, per address, the whole site, tries, 10 minutes) and the clean-up, the WhatsApp template's content, SMS through Twilio Verify after WhatsApp fails, off in production without a provider, and a code as proof when adding a number.
- **Checked locally (23 Oct 2026):** `/login` → Phone number → the test customer's number → the code on screen → their account (credit, Plus, referral code, "Signed in with 0300…"); "Sign out everywhere" signed out and the old token was refused; a new number on `/ur/login` asked for the name in Urdu and opened a new account with its referral code; an emailed test sign-in adding a number with a guest booking proved it with a code and saw that booking.

## 4. Brand kit

Saved in `F:\mjazo\brand\`, outside this repo. A copy of the PDF is in the user's Downloads folder.

- **`Mjazo_Brand_Guidelines.pdf`:** 18 pages, A4 landscape.
- **`BRAND-NOTES.md`:** the spec the PDF was built from.
- **`logo\`:** lockup, mark, wordmark and app icon, as outlined SVG and PNG.
- **Taglines:** "Everything your home needs. One tap." and "Ghar ka har kaam. Pakka."
- **Colour:** one saffron, `#F4A437`. WhatsApp buttons use green with dark (ink) text.

**Open brand decisions for the founder:**

- a native copywriter's check of the Urdu tagline
- print colours and a Pantone match
- a trademark search with IPO Pakistan
- the company's own photo shoot

---

## 5. The CMS (`/admin`)

The team and the client can edit everything on the site without code changes. Full details are in
[docs/CMS-STATUS.md](docs/CMS-STATUS.md).

### Phase 1: Foundation. Done, live

- **Sign-in and roles:** Supabase sign-in (password or magic link) with Owner, Admin, Editor, Author, SEO and Viewer roles. Owners invite people by email.
- **Editing:** drafts with autosave, a conflict warning, publish, scheduled publish, hide and restore, drag to reorder.
- **History:** every version is kept and can be restored. There's also an activity log.
- **Defaults and fallback:** each type's built-in content is the default, and the site falls back to it if the database is down.
- **Catalogue and settings:** the full catalogue and the site settings (contact, policy values, Plus, referral, feature switches) are editable.

### Phase 2: Editors. Done, live

- **Every page** has its own editable content type.
- **Shared templates** for world, category, service and area pages, using per-item placeholders like `{{area}}`.
- **Header, footer and mobile tabs.**
- **Blog, help and legal pages** with a rich-text editor.
- **Placeholders** keep prices and policy numbers in sync, e.g. `{{policy.redoHours}}`.
- **Preview drafts** on the real site.

### Phase 3: Media. Done, live

- **Media library:**
  - drag-and-drop uploads straight to Supabase Storage
  - type and size limits; SVG blocked, and contents checked against the file type
  - alt text in English and Urdu, with an AI suggestion
  - focal point, tags, "where it's used", replace everywhere at once
  - delete blocked while a file is in use
- **Photos** for categories, services, world tiles, blog covers and 14 page headings. The home video and 3D models for world pages come from the library too.
- **Optimised images** through Next's image component.

### Phase 4: Urdu. Done, live

- **Addresses:** the Urdu site lives at `/ur/...`, with right-to-left layout and Nastaliq type.
- **Links** stay in Urdu once you're on the Urdu site.
- **Interface text:** about 200 strings with hand-written Urdu, plus Urdu menus.
- **AI translation:** per entry, or "translate everything missing" across the whole site. Every AI translation is flagged until a person reviews it.
- **A switch keeps the Urdu site hidden from search engines** until you turn it on.

### Phase 5: SEO. Done, live

- **SEO fields** on every page and item: search title, description, focus keyword, share image, hide from search, canonical address.
- **SEO settings:** title patterns in English and Urdu, defaults, robots rules, verification codes.
- **Metadata on every page** comes from one helper. Pages without a share image of their own now use the Mjazo card; service pages keep their own generated card.
- **Robots and sitemap** follow the settings.
- **SEO role:** limited to SEO fields. Authors see SEO fields locked.
- **SEO score:** up to 16 checks on the real page, with tests.
- **SEO dashboard (`/admin/seo`):**
  - every page (383, including the 176 area pages) with its score and top problems
  - "Audit all" (or one section), filters, sorting, and each page's full report
  - Google PageSpeed for phone and desktop
  - site-wide panels: duplicate titles and descriptions, broken internal links, orphan pages, Urdu coverage
- **Redirects (`/admin/redirects`):**
  - add, edit and delete, with loop and clash checks as you type
  - a "where does this address go?" tester, visit counts, and warnings for chains and hidden pages
  - the redirects built into the code, shown read-only
  - automatic redirects when a published address changes, kept free of chains and loops
- **SEO group in every editor:** Google and WhatsApp previews, live checks, "Suggest with AI", and the page's latest score.
- **Weekly check:** every Monday, Vercel re-audits every page and runs PageSpeed on the main ones (`/api/cron/seo-weekly`; needs `CRON_SECRET`).

**Checked locally:** 379 of 383 pages audited in the dashboard (average 86, none under 50). The other 4 hit dev-server errors and load fine on their own. Redirects were tested end to end: English, Urdu, query strings, loop refusal, edit and delete.

### Phase 6: Page builder and live preview. Done, live

- **Block pages (Pages → Block pages):** new pages at any free address, like `/eid-sale` or `/campaigns/eid-sale`, with their own SEO. They're in the sitemap and the SEO dashboard, have Urdu at `/ur/…`, and get a redirect when their address changes. Addresses that belong to the site's own sections are refused.
- **13 blocks,** built from the site's own components:
  - hero, text, image and text, cards
  - services (picked, by category or most booked), questions, call to action
  - promises strip, numbers, video, gallery, enquiry form, spacer
  - Backgrounds and anchors on most blocks; new blocks start with sample content.
- **Live preview beside every editor** (not just block pages): the real page with the draft, at desktop or phone width, in English or Urdu. It updates after each autosave and follows the block you open.
- **Click-to-edit:** click any text in the preview to open its field, including inside collapsed blocks and lists, and in Urdu.
- **Fixed: new items returned 404 after a deploy.** A setting in the site layout meant services, posts, help topics, areas and block pages published after a deploy only appeared after the next deploy. They now render on their first visit.
- **Fixed:** an empty Urdu rich-text box could block saving or leave a stray draft.

**Checked:** a 13-block page was built in the admin, previewed and published, and checked at desktop and phone width. Its address change added the redirect, and a production build served it (and 404s for unknown addresses) correctly.

### Phase 7: Hardening. Done

- **Tests for every role against every action** (31 actions × 6 roles) through the real server actions. They found one bug, now fixed: the SEO role couldn't save built-in items without an SEO group.
- **Permission audit fixes:**
  - drafts only for existing entries
  - a schedule is cancelled when someone who can't publish edits the entry
  - the SEO role discards SEO changes only
  - new items are checked field by field
  - the SEO tools only accept the site's own paths
- **Backup (Team → Backup):** Owners and Admins download everything as one file. Owners restore it as drafts or exactly; nothing is deleted, and entries that already match are left alone.
- **Two-step sign-in** with an authenticator app, required for Owners and Admins. Owners can reset it for others.
- **History compare:** any version against the form or the live version, word by word, then restore it.
- **Saving:** Ctrl+S keeps a version in History. Content that's back to the live version no longer shows as "Unpublished changes".
- **Several Owners:** `CMS_OWNER_EMAIL` takes several emails, and an Owner's first emailed sign-in link creates their account.
- **Performance:** about 2 minutes to build on Vercel. Every page's data is 13.5 KB smaller (category FAQs no longer go to the browser). Cache tags were checked: a page edit refreshes only that page.
- **Team handbook:** `docs/Mjazo-CMS-Team-Handbook.pdf`: 20 pages in the brand style, each built around a real screenshot of the admin with numbered callouts. Source and screenshot script are in `docs/handbook/`.

### Interface text, phase 2 (19 Oct 2026). Done, live

- **Buttons & labels** has six new groups: the AI chat, account screens, offers/Plus/referrals, report a problem and ratings, installing the app, and the services menu and search.
- **Each AI tool's page has a "Tool text" group** (Ghar Scan, Home Pulse, Glam Mirror, Shaadi Orchestrator). Home Pulse's includes the wording of every reminder; Shaadi's includes the look names, warnings and each person's WhatsApp summary.
- **Home page → Hero phone app** holds the text inside the tappable phone (also on `/app`).
- **Pages → Become a pro** (new) holds the pro pages in English, Urdu and Roman Urdu. On `/ur` they open in Urdu.
- **On `/ur` the AI tools answer in Urdu** (Ghar Scan, Shaadi assistant, Look Card, Concierge) unless the customer writes in another language, and their error messages come from the CMS.
- Details are in [docs/CMS-STATUS.md](docs/CMS-STATUS.md).

---

## 6. Infrastructure

### Hosting and code

- **Vercel:** account `thehashirsukhera-8511`, project `mjazo`, production address https://mjazo.vercel.app.
  - When a stage adds a migration, run `--migrate` **before** deploying: new code that writes new columns fails until they exist (on 21 Oct 2026 stage 4 was briefly live before 0008 ran).
  - Redeploy with `cd F:\mjazo\website; npx vercel deploy --prod --yes` (one line). Check the output says `Directory F:\mjazo\website`: on 21 Oct 2026 a deploy run from `F:\mjazo` put that whole folder live as plain files until it was redeployed.
  - Always check the account first with `npx vercel whoami`. An earlier deploy once went to an unrelated client's team by mistake.
- **GitHub:** https://github.com/THS001/mjazo, branch `main`. Commits are authored as THS001 <thehashirsukhera@gmail.com>.
- **Local development:** run `npm run dev` in `website/`. Without Supabase, CMS edits and form submissions are saved in `.data/` on that computer.

### Database (Supabase): connected

Project `xjyafabyscamelebzrsb` (https://xjyafabyscamelebzrsb.supabase.co), set up on 5 October 2026 with `node scripts/setup-supabase.mjs`. The script runs every migration, checks the keys and adds the settings to Vercel. The owner types the password and keys into it, and they're never saved to a file.

| Migration | Tables |
|---|---|
| `0001_submissions.sql` | `submissions` (bookings, waitlist, enquiries, applications) |
| `0002_ai.sql` | `conversations` (Concierge) |
| `0003_ops.sql` | `ops_docs` (jobs, pros, applicants, complaints, wedding plans, ratings, audit) |
| `0004_cms.sql` | `cms_entries`, `cms_versions`, `cms_users`, `cms_media`, `cms_redirects`, `cms_seo_reports`, `cms_audit`, plus the `media` storage bucket |
| `0005_core.sql` | The core engine: customers, addresses, zones, pros (+ availability, time off), bookings (+ lines, events, payments, ratings), the ledger (accounts, entries, postings), payouts, promo codes, events, notifications, audit log, core_meta. Run on the live database on 21 Oct 2026 |
| `0006_mission_control.sql` | Mission control: the operations roles on `cms_users`, `money_requests` (refunds and credits waiting for approval), `payout_runs` (+ new payout columns), `ops_requests` (the requests inbox's status), who changed each promo code. Run on the live database on 21 Oct 2026 |
| `0007_pro_app.sql` | The pro app: `job_offers` (one open offer per visit), and pros found by email without regard to case. Run on the live database on 21 Oct 2026 |
| `0008_client_account.sql` | The client account: a booking's `preferred_pro_id`, `credit_used` and `address_id`, and indexes for customers' emails, addresses and promo uses. Run on the live database on 21 Oct 2026 |
| `0009_automation.sql` | Automation: the rules, the message log (one message per reason), STOP opt-outs, phone push tokens. Run on the live database on 21 Oct 2026 |
| `0010_plus_gifts_referrals.sql` | Plus memberships, gift cards, referral rewards; customers' referral codes and who referred them |
| `0011_live_tracking.sql` | `visit_locations`: a pro's latest point while she's on the way to a visit |
| `0012_phone_sign_in.sql` | `phone_codes` (sign-in codes: hash, channel, tries, expiry) and `customers.session_epoch` ("sign out everywhere") |

With Supabase connected, the cross-page flows (apply → interview link, booking → ops console,
complaint → Trust Desk) can now work end to end on the live site. They haven't been re-tested live yet.

### Settings (environment variables)

All are listed with explanations in [.env.example](.env.example).

| Setting | Needed for | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | All AI features, AI translation, alt text, SEO suggestions | Set (production) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Saving anything durably | Set (production; rotate the secret key, see section 7) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CMS sign-in and media uploads | Set (production) |
| `CMS_OWNER_EMAIL` | The CMS Owners | Set: mjazosupport@gmail.com, thehashirsukhera@gmail.com |
| `CMS_MFA_REQUIRED` | Two-step sign-in for Owners, Admins and Finance (on unless `false`) | Not set (on) |
| `DATABASE_URL` (+ optional `DATABASE_CA_CERT`) | The core engine (bookings, pros, ledger, slot capacity) | Set (production, secret): Supabase transaction pooler `aws-0-ap-northeast-1`, 21 Oct 2026. `DATABASE_CA_CERT` not set (optional) |
| `SESSION_SECRET` | Turning on the `/pro` app (signs pros' sessions; changing it signs every pro out). `/ops` no longer needs a passcode: staff sign in with their email (`OPS_PASSCODE` is no longer used) | Set (production, secret), 21 Oct 2026, by `node scripts/setup-supabase.mjs --migrate` |
| `CRON_SECRET` (plus a 5-minute pinger) | Safety Guardian, scheduled publishing, automation and the weekly SEO check | Not set |
| `RESEND_API_KEY`, `OPS_EMAIL`, `OPS_FROM` | Emailing every submission to the team; customer emails from automation | Not set |
| `MESSAGES_FROM` | The sender of customer emails (falls back to `OPS_FROM`) | Not set |
| `WHATSAPP_*` | Concierge on WhatsApp; automation's template messages | Not set |
| `WHATSAPP_OTP_TEMPLATE`, `WHATSAPP_OTP_LANGS` | Phone sign-in codes on WhatsApp (an Authentication template; with the `WHATSAPP_*` settings) | Not set |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | Phone sign-in codes by SMS (Twilio Verify) | Not set |
| `EXPO_ACCESS_TOKEN` | Push to the phone apps, only with Expo's enhanced push security (optional) | Not set |
| `STT_API_KEY` | WhatsApp voice notes | Not set |
| `PAGESPEED_API_KEY` | More PageSpeed audits (optional) | Not set |

---

## 7. Setup checklist for the owner

1. ~~Supabase project, migrations, settings in Vercel, Owners, sign-in URLs, deploy~~ Done on 5 October 2026.
2. **Rotate the pasted secrets:** create a new Supabase secret key, put it in Vercel as `SUPABASE_SERVICE_ROLE_KEY` and delete the old one. Also reset the database password; the site doesn't use it.
3. Add an SMTP sender in Supabase (Authentication → Emails) before inviting the team: the built-in email only sends a few an hour. Then invite the team from People & roles and share the handbook PDF.
4. Run `node F:\mjazo\website\scripts\setup-supabase.mjs --migrate` for the pro app: it adds migration 0007 and offers to make `SESSION_SECRET` (answer **y**). Pros sign in with the phone + PIN ops set for them. For email sign-in, save a pro's email on her profile in mission control; if Supabase's Redirect URLs list only specific pages, add `https://mjazo.vercel.app/pro/auth/callback` there (Authentication → URL Configuration). For mission control (`/ops`), give each team member an operations role (Dispatcher, Support, Finance or Recruiter) in `/admin/people`; Finance must set up two-step sign-in on first use.
5. Run `node scripts/setup-supabase.mjs --cron`: it makes `CRON_SECRET`, stores it in Vercel and shows the pinger steps. Point an external 5-minute pinger (cron-job.org) at `/api/cron/safety` and `/api/cron/cms-publish` with that secret, then redeploy. The weekly SEO check then runs by itself (a Vercel cron in `vercel.json`).
6. Optionally set `RESEND_API_KEY` and the `OPS_*` emails, the WhatsApp Cloud API settings, `STT_API_KEY` and `PAGESPEED_API_KEY`.
7. Deploy (`npx vercel deploy --prod` from `website/`) after checking that `npx vercel teams ls` shows **thehashirsukhera-8511's projects**. `vercel login` signs in whichever Vercel account your browser is using, and that has picked another client's account before; approve the login in a window signed in as thehashirsukhera-8511. Run it in a normal (not administrator) PowerShell: the administrator window on this computer is another Windows user and keeps its own login.
8. ~~**Connect the core engine:**~~ Done 21 Oct 2026. run `node scripts/setup-supabase.mjs --migrate` in a normal PowerShell in `website/`.
   - It asks for the database password, creates the new tables, then asks for Supabase's "Transaction pooler" connection string (Connect → Transaction pooler), checks it and saves it to Vercel as `DATABASE_URL`.
   - Then Claude redeploys.
   - Run again on 21 Oct 2026 for mission control (migration 0006). The script runs every migration; each is safe to run again. If `DATABASE_URL` is already set it first asks "Replace it? (y/N)": answer that, then type the password.
9. **For the client account (stage 4):**
   - ~~run `--migrate` for migration 0008~~: done 21 Oct 2026;
   - in Supabase → Authentication, make sure new sign-ups are allowed (customers make their account with the emailed link);
   - if the Redirect URLs aren't a wildcard, add `https://mjazo.vercel.app/account` and `https://mjazo.vercel.app/ur/account`;
   - add an SMTP sender (e.g. Resend) before telling customers about it: Supabase's own email sends only a few an hour.
10. **For automation (stage 5):**
   - ~~run `--migrate` for migration 0009 before deploying~~: done 21 Oct 2026, then deployed;
   - add a third 5-minute pinger for `/api/cron/automation` (item 5; the reminders and review requests rely on it, the rest also runs after each change);
   - for WhatsApp messages: make the templates in Meta (WhatsApp Manager → Message templates), with the parameters in the order mission control → Automations shows, then type each template's name there. Meta must approve each template;
   - for emails: `RESEND_API_KEY` and `MESSAGES_FROM` (a verified sender domain in Resend);
   - choose auto-assign's mode, and switch on the Home Pulse and win-back messages when wanted.
11. In `/admin/translate`, run "Translate everything missing". Have someone review the Urdu, then switch on the Urdu site under Settings → Feature switches.
12. **For the phone apps (stage 6):** ~~deploy~~ (done 21 Oct 2026), then follow [mobile/README.md](mobile/README.md):
   - try both apps with Expo Go on your phone (`npm run customer` / `npm run pro` in `mobile/`);
   - for email sign-in in the apps, add `mjazo://**`, `mjazopro://**` and `exp://**` to Supabase's Redirect URLs (and the SMTP sender from item 3);
   - for the stores: an Expo account (`eas login`, `eas init` in each app, then `eas build`), and a Google Play developer account to publish. Push notifications start working in the installed apps after `eas init`.
13. **For Plus, gift cards, referrals, live tracking and phone sign-in (after the platform, parts 1 to 3):** run `--migrate` (0010, 0011 and 0012) **before** deploying, then deploy. Then, for phone sign-in, one or both of:
   - **WhatsApp:** the WhatsApp Cloud API settings (item 6), and in WhatsApp Manager → Message templates an **Authentication** template with a "Copy code" button, in English (and Urdu if wanted). Put its name in Vercel as `WHATSAPP_OTP_TEMPLATE` and its languages as `WHATSAPP_OTP_LANGS` (e.g. `en,ur`);
   - **SMS:** a Twilio account with a Verify service; put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SID` (the service's VA… id) in Vercel;
   - then redeploy. Until one is set, the live site offers email sign-in only.

---

## 8. Placeholders to confirm with the founder

These are all editable in `/admin` (Settings and the Catalogue) once Supabase is connected.

- **WhatsApp Business number:** currently `923000000000`.
- **Support phone and email:** `+92 300 0000000` and `hello@mjazo.pk`.
- **All service prices** (132 services) and the PKR 2,500 minimum order.
- **Policy values:**
  - free changes up to 3 hours before
  - redo within 24 hours
  - earliest slot 2 hours ahead
  - a 30-day technician warranty
  - the late-change fee amount
- **Plus:** PKR 2,500 a year for 10% off.
- **Referral rewards:** PKR 500 for the friend, PKR 500 for the referrer.
- **Legal text:** needs a lawyer's review.
- **Ops:** the pro share (75%) and the protocol manual.
- **Launch scope:** which categories and areas go live at launch. Everything is live now, at the user's request.

---

## 9. What's left, in order

1. ~~Deploy the work since 5 October~~: deployed on 19 October 2026 (the phase 7 media fix and interface text phase 2).
2. **The platform build** (plan approved 21 October 2026; one or more sessions per stage):
   1. ~~Core engine~~: built and live 21 October (section 3b). Until pros are added in the core, checkout runs in "open" mode (every window open, the team confirms).
   2. ~~Mission control~~: live 21 October (section 3c). Still to do: give the team their operations roles in `/admin/people` (needs SMTP in Supabase for invites, section 7).
   3. ~~Pro app~~: live 21 October (section 3d). Still to do: give the real pros a PIN (and an email, for email sign-in) in mission control → Pros.
   4. ~~Client account~~: live 21 October (section 3e). Still to do: section 7, item 9 (Supabase sign-ups and redirect URLs, SMTP), then try a real email sign-in.
   5. ~~Automation~~: live 21 October (section 3f). Still to do: `CRON_SECRET` and the automation pinger, then WhatsApp templates or Resend (section 7, item 10). Keep auto-assign on "suggest" until the real pros are verified.
   6. ~~Mobile apps~~: built 21 October, API live (section 3g). To do: try both apps with Expo Go (mobile/README.md), add the apps' redirect URLs in Supabase for email sign-in, then `eas init` and store builds with your Expo account (and Google Play to publish).
3. **Owner setup:** section 7 (rotate secrets, SMTP, `CRON_SECRET` and pingers, `SESSION_SECRET` for the pro app, staff roles).
4. **Re-test the live flows** that need Supabase: booking → ops console, apply → interview, complaint → Trust Desk.
5. **Urdu content:** the AI translation pass, a human review (including the new interface Urdu), then switching on the Urdu site.
6. **Founder confirmations:** section 8 (contact details, prices, policies, legal text).
7. **Brand:** the open decisions in section 4.

~~Interface text still in code~~: done on 19 October 2026.

---

## 10. Notes for developers

- **Content lives in the CMS.** Built-in defaults are in `lib/catalog.ts`, `lib/content.ts`, `lib/site.ts` and the types in `lib/cms/types/*`. Pages read it with `getPage()`, `getCatalog()`, `getContent()`, `getSettings()` and `getUi()`. Client components use `useCatalog()`, `useSite()`, `useNav()` and `useT()`.
- **Every page under `app/[locale]`** must call `await pageLocale(params)` first, in both the page and `generateMetadata`. It 404s anything but `en`/`ur` in the locale's place: a missing file like `/x.pdf` skips `proxy.ts` and arrives as locale "x.pdf", and used to show the home page with a 200. Only the root layout uses `layoutLocale()`, which falls back to English so the 404 page has a layout.
- **Use the locale-aware link and router.** Use `Link` and `useRouter` from `@/components/site/locale-link`, not `next/link` or `next/navigation`, so Urdu pages keep their `/ur` links.
- **Never make a server component async** (e.g. `FAQ`) if it renders inside the layout's client wrappers: it causes a React `useId` hydration mismatch.
- **Booking arrival windows are fixed** in `lib/time.ts` and must not be made editable, because jobs store their labels. Urdu display labels come from `windowLabel()`.
- **Admin pages start with `await pageUser()`** (from `lib/cms/auth`), which sends signed-out visitors to the sign-in page. Next renders a page alongside its layout, so the layout's own redirect isn't enough.
- **Redirects:** the ones built into the code are in `lib/builtin-redirects.mjs`, used by `next.config.mjs` and shown in the CMS. Matching, tracing and the loop checks are pure functions in `lib/cms/redirect-match.ts`, shared by `proxy.ts`, the admin and the tests.
- **Adding a block:** add it to `BLOCKS` in `lib/cms/types/block-page.ts` (fields, an icon from the list in `components/admin/fields.tsx`, starter content) and a `case` in `components/cms/blocks.tsx`. Give its main texts `data-cms="blocks.<n>.<field>"` for click-to-edit. `blocks.test.ts` checks every block's starter content.
- **Never set `dynamicParams = false` in `app/[locale]/layout.tsx`.** Next applies it to every page below, and items published after a deploy would 404 until the next deploy.
- **Share images:** `pageMetadata()` sets one on every page, because a page's own `openGraph` replaces the card it would inherit. A route with its own `opengraph-image` file must pass `card: true`, or the default card replaces it.
- **Windows dev machine:**
  - Stop the dev server before `git mv` (it locks folders).
  - After big changes the dev server can return 404 everywhere except `/`; restart it. If even `/admin` gives 404, stop it and delete `.next/dev`.
  - Compiling hundreds of routes at once (e.g. "Audit all" on a fresh dev server) can briefly corrupt the dev server's own manifests, giving 500s with JSON errors. Restart it. The production build isn't affected.
  - In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `/paths` to scripts.
- **Shell heredocs strip backslashes and backticks** in code. Edit code with an editor or a script file, never a heredoc.
- **Browser catalogue:** the layout sends `browserCatalog(catalog)` to `CmsProvider`, without category FAQs and "not included" lists. Client components that need them must get them from the server (`getCatalog()`).
- **Saving:** autosave and Ctrl+S go through `saveEdits()`, which clears a draft that's back to the live version. Publish and schedule still use `saveDraft()`.
- **Interface text:** shared text goes in `lib/cms/types/ui.ts` (`useT()`). A tool's own text goes in `lib/cms/types/tool-text/<tool>.ts` (English and Urdu objects of the same shape) and in a `toolText()` group on its page type; the page passes it to the tool as a prop. `lib/cms/strings.test.ts` checks the Urdu matches the English, `{{tokens}}` included. Don't name a placeholder `site`, `policy`, `plus`, `referral`, `flags` or `catalog`: `getPage()` fills those.
- **AI tool APIs** take the page's `locale` and return `{ code, error }` on failure; the page shows the code's message from the CMS.
- **Engines with wording:** `buildPlan()` (`lib/pulse.ts`) and `computeSchedule()`, `diffSchedules()`, `personMessage()` (`lib/shaadi.ts`) take optional wording, English by default. Decide behaviour by keys, never by labels.
- **The core engine (`lib/core/`):**
  - All SQL goes through `core()` / `Db` (`lib/core/db.ts`); ops code calls `lib/server/ops.ts`, which picks the core or the older document store.
  - **Never change `0005_core.sql` once it has run on the live database:** add `0006_….sql`. Migrations must be safe to run again.
  - **Money moves only through `lib/core/ledger.ts`**: never store a balance, never edit a posting.
  - Change a job only through `mutateJob()`, which posts to the ledger, writes outbox events and keeps the history append-only.
  - PGlite ignores a second constructor argument when the first isn't a path: pass one options object.
  - pg and PGlite return dates as `YYYY-MM-DD` and timestamps as ISO strings (parsers in `db.ts`). Pass JSON values as `JSON.stringify(x)` with `$n::jsonb`.
  - The local PGlite database (`.data/pglite`) is opened by one process at a time: stop the dev server before any script that opens it.
  - `core()` keeps its handle on `globalThis`. The dev server re-runs modules after each edit, and a second PGlite opened on the same folder split the local data in two (one route saw a change, another didn't). Don't move it back to a module variable.
- **Mission control (`/ops`):**
  - Every `/api/ops` handler starts with `requireStaff(<permission>)` (`lib/server/staff.ts`), per action where actions differ. Permissions by role are in `lib/ops/access.ts`; `lib/server/ops-permissions.test.ts` calls every action as every role, so a new action needs a row there.
  - Record staff actions with `audit(email, …)` (`lib/server/audit.ts`). Money actions write their audit entry inside their own transaction (`lib/core/money.ts`).
  - Money moves from mission control go through `lib/core/money.ts` (approval records) and then `lib/core/ledger.ts` (postings). Never post from a route.
- **The pro app (`/api/v1/pro`):**
  - Every handler is `asPro(async (pro, req, ctx) => …)` (`lib/server/pro-auth.ts`): it signs her in from the bearer token or the cookie and answers errors like the other APIs. Only ever read or change her own visits, offers and money; `lib/server/pro-api.test.ts` checks that one pro can't reach another's.
  - Offers change visits only through `lib/core/offers.ts` (it uses `mutateJob()`); the board's direct assign, reschedule and cancel withdraw an open offer (`lib/server/ops.ts`).
  - Before a pro accepts, an offer must not carry the customer's name, phone or address (`proOffers`).
  - The app's text is in `components/staff/pro/strings.ts` (English, Urdu, Roman Urdu).
- **The client account (`/api/v1/customer`):**
  - Handlers use `asCustomer` (signed in, number added) or `asAccount` (signed in) from `lib/server/customer-auth.ts`; the logic is in `lib/server/customer-api.ts` and `lib/core/customers.ts`. Only ever touch the customer's own bookings and addresses (`ownBooking`).
  - A pro is shown to customers by her first name only.
  - The browser sends the sign-in with `customerApi()` (`lib/client/customer.ts`); `useAccount()` says whether someone is signed out, needs to add their number, or is in.
  - Wallet credit is set aside on the booking (`credit_used`) and posted with `applyCredit` when the visit completes (`postLedger` in `lib/core/jobs.ts`). What the pro collects is total − credit.
  - Locally, `/login` offers the test sign-in (`/api/v1/customer/dev-login`); the browser keeps its token in localStorage.
- **Staff tools locally:** start the `mjazo-web-staff` preview configuration (`.claude/launch.json`). Without Supabase, `/ops` offers "Continue as local …" for any role (`/api/ops/dev-login`, refused in production); pros get PINs from ops.
- **Checks before pushing:** `npx tsc --noEmit`, then `npm test` (429 tests), then `npx next build` (828 pages, plus two per published block page). For the phone apps: `npm run typecheck` in `mobile/`.
- **New API routes on the dev server:** a route added while an older `.next/dev` cache exists can answer 404 (the request falls through to the page catch-all). Touch the new `route.ts` and it's picked up.
