# Mjazo: project progress

_Last updated 4 October 2026._

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
| Staff tools (`/ops` console, `/pro` app, recruiting interviews) | Built and live, but switched off until their passcodes are set |
| CMS phase 1: foundation | Done, live |
| CMS phase 2: every page editable | Done; the deploy ran but I couldn't confirm it went live |
| CMS phase 3: media library | Done, not deployed |
| CMS phase 4: Urdu site | Done, not deployed |
| CMS phase 5: SEO | About 70% done |
| CMS phase 6: page builder and live preview | Not started |
| CMS phase 7: hardening and team handbook | Not started |
| Supabase (database and file storage) | **Not connected yet.** Needed before anything saved in `/admin` is kept, and for cross-page flows on the live site |

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

These stay switched off until `OPS_PASSCODE` and `SESSION_SECRET` are set. Their data goes to the
Supabase table `ops_docs` (migration 0003).

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

### Phase 2: Editors. Done (deploy not confirmed)

- **Every page** has its own editable content type.
- **Shared templates** for world, category, service and area pages, using per-item placeholders like `{{area}}`.
- **Header, footer and mobile tabs.**
- **Blog, help and legal pages** with a rich-text editor.
- **Placeholders** keep prices and policy numbers in sync, e.g. `{{policy.redoHours}}`.
- **Preview drafts** on the real site.

### Phase 3: Media. Done, not deployed

- **Media library:**
  - drag-and-drop uploads straight to Supabase Storage
  - type and size limits; SVG blocked, and contents checked against the file type
  - alt text in English and Urdu, with an AI suggestion
  - focal point, tags, "where it's used", replace everywhere at once
  - delete blocked while a file is in use
- **Photos** for categories, services, world tiles, blog covers and 14 page headings. The home video and 3D models for world pages come from the library too.
- **Optimised images** through Next's image component.

### Phase 4: Urdu. Done, not deployed

- **Addresses:** the Urdu site lives at `/ur/...`, with right-to-left layout and Nastaliq type.
- **Links** stay in Urdu once you're on the Urdu site.
- **Interface text:** about 200 strings with hand-written Urdu, plus Urdu menus.
- **AI translation:** per entry, or "translate everything missing" across the whole site. Every AI translation is flagged until a person reviews it.
- **A switch keeps the Urdu site hidden from search engines** until you turn it on.

### Phase 5: SEO. About 70% done

**Done:**

- **SEO fields** on every page and item: search title, description, focus keyword, share image, hide from search, canonical address.
- **SEO settings:** title patterns in English and Urdu, defaults, robots rules, verification codes.
- **Metadata on every page** comes from one helper.
- **Robots and sitemap** follow the settings.
- **SEO role:** limited to SEO fields.
- **Redirects:** including automatic redirects when an address changes.
- **SEO score:** 16 checks, with tests.
- **Report storage** and the server actions behind audits, PageSpeed, AI suggestions and redirects.

**Left:**

- the SEO dashboard screen and the redirects screen
- a Google result preview and AI suggestions inside the editor
- tests for redirects and the SEO role
- a check in the browser, a production build, and a push

### Phase 6: Page builder and live preview. Not started

- new pages at any address, built from blocks:
  - hero, text, image and text, cards, services rail
  - FAQ, call to action, stats, video, gallery
  - enquiry form, spacer
- a live preview beside the editor, at phone and desktop widths, in English and Urdu
- click text in the preview to jump to its field

### Phase 7: Hardening. Not started

- tests for every role against every action
- a permission audit
- JSON backup export and import
- two-step sign-in (MFA) for Owners and Admins
- a side-by-side comparison in version history
- performance checks
- a short team handbook PDF in the brand style

---

## 6. Infrastructure

### Hosting and code

- **Vercel:** account `thehashirsukhera-8511`, project `mjazo`, production address https://mjazo.vercel.app.
  - Redeploy with `npx vercel deploy --prod --yes` from `website/`.
  - Always check the account first with `npx vercel whoami`. An earlier deploy once went to an unrelated client's team by mistake.
- **GitHub:** https://github.com/THS001/mjazo, branch `main`. Commits are authored as THS001 <thehashirsukhera@gmail.com>.
- **Local development:** run `npm run dev` in `website/`. Without Supabase, CMS edits and form submissions are saved in `.data/` on that computer.

### Database (Supabase): not connected yet

| Migration | Tables |
|---|---|
| `0001_submissions.sql` | `submissions` (bookings, waitlist, enquiries, applications) |
| `0002_ai.sql` | `conversations` (Concierge) |
| `0003_ops.sql` | `ops_docs` (jobs, pros, applicants, complaints, wedding plans, ratings, audit) |
| `0004_cms.sql` | `cms_entries`, `cms_versions`, `cms_users`, `cms_media`, `cms_redirects`, `cms_seo_reports`, `cms_audit`, plus the `media` storage bucket |

Without Supabase on Vercel, every API route has its own temporary storage. So these flows can't
work end to end on the live site: apply → interview link, booking → ops console, complaint → Trust Desk.

### Settings (environment variables)

All are listed with explanations in [.env.example](.env.example).

| Setting | Needed for | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | All AI features, AI translation, alt text, SEO suggestions | Set (production) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Saving anything durably | Not set |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CMS sign-in and media uploads | Not set |
| `CMS_OWNER_EMAIL` | The first CMS Owner | Not set |
| `OPS_PASSCODE`, `SESSION_SECRET` | Turning on `/ops` and `/pro` | Not set |
| `CRON_SECRET` (plus a 5-minute pinger) | Safety Guardian and scheduled publishing | Not set |
| `RESEND_API_KEY`, `OPS_EMAIL`, `OPS_FROM` | Emailing every submission to the team | Not set |
| `WHATSAPP_*` | Concierge on WhatsApp | Not set |
| `STT_API_KEY` | WhatsApp voice notes | Not set |
| `PAGESPEED_API_KEY` | More PageSpeed audits (optional) | Not set |

---

## 7. Setup checklist for the owner

1. Create a Supabase project and add the four Supabase settings to Vercel.
2. Run migrations `0001` to `0004` in the Supabase SQL editor.
3. Set `CMS_OWNER_EMAIL`, sign in at `/admin`, and invite the team from People & roles.
4. Set `OPS_PASSCODE` and `SESSION_SECRET` to turn on the staff tools.
5. Set `CRON_SECRET`. Point an external 5-minute pinger at `/api/cron/safety` and `/api/cron/cms-publish`.
6. Optionally set `RESEND_API_KEY` and the `OPS_*` emails, the WhatsApp Cloud API settings, `STT_API_KEY` and `PAGESPEED_API_KEY`.
7. Deploy (`npx vercel deploy --prod` from `website/`). Phases 3 to 5 of the CMS aren't live yet.
8. In `/admin/translate`, run "Translate everything missing". Have someone review the Urdu, then switch on the Urdu site under Settings → Feature switches.

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

1. **Finish CMS phase 5:** the SEO dashboard, the redirects screen, the Google preview and AI suggestions in the editor, tests, a build, then commit and push.
2. **CMS phase 6:** the block page builder, live preview and click-to-edit.
3. **CMS phase 7:** tests, the permission audit, backup export and import, MFA, the history comparison, performance checks and the team handbook.
4. **Interface text still in code:**
   - inside the AI tools (Ghar Scan, Home Pulse, Glam Mirror, Shaadi planner, Concierge)
   - account screens, offer buttons and the partner flow
   - move it into "Buttons & labels", with Urdu
5. **Owner setup:** section 7 (Supabase, settings, pingers, deploy).
6. **Urdu content:** the AI translation pass, a human review, then switching on the Urdu site.
7. **Founder confirmations:** section 8 (contact details, prices, policies, legal text).
8. **Brand:** the open decisions in section 4.

---

## 10. Notes for developers

- **Content lives in the CMS.** Built-in defaults are in `lib/catalog.ts`, `lib/content.ts`, `lib/site.ts` and the types in `lib/cms/types/*`. Pages read it with `getPage()`, `getCatalog()`, `getContent()`, `getSettings()` and `getUi()`. Client components use `useCatalog()`, `useSite()`, `useNav()` and `useT()`.
- **Every page under `app/[locale]`** must call `await pageLocale(params)` first, in both the page and `generateMetadata`.
- **Use the locale-aware link and router.** Use `Link` and `useRouter` from `@/components/site/locale-link`, not `next/link` or `next/navigation`, so Urdu pages keep their `/ur` links.
- **Never make a server component async** (e.g. `FAQ`) if it renders inside the layout's client wrappers: it causes a React `useId` hydration mismatch.
- **Booking arrival windows are fixed** in `lib/time.ts` and must not be made editable, because jobs store their labels. Urdu display labels come from `windowLabel()`.
- **Windows dev machine:**
  - Stop the dev server before `git mv` (it locks folders).
  - After big changes the dev server can return 404 everywhere except `/`; restart it.
  - In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `/paths` to scripts.
- **Shell heredocs strip backslashes and backticks** in code. Edit code with an editor or a script file, never a heredoc.
- **Checks before pushing:** `npx tsc --noEmit`, then `npm test` (81 tests), then `npx next build` (826 pages).
