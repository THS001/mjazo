# Mjazo: project progress

_Last updated 5 October 2026 (CMS phase 7 done, Supabase connected)._

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
| CMS phase 2: every page editable | Done, live |
| CMS phase 3: media library | Done, live |
| CMS phase 4: Urdu site | Done, live (the Urdu site stays hidden until switched on) |
| CMS phase 5: SEO | Done, live |
| CMS phase 6: page builder and live preview | Done, live |
| CMS phase 7: hardening and team handbook | Done; the last fixes go out with the next deploy |
| Supabase (database and file storage) | **Connected (5 Oct 2026).** CMS content, media, bookings and staff data are now stored durably |

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
- **Team handbook:** `docs/Mjazo-CMS-Team-Handbook.pdf` (10 pages, brand style; source in `docs/handbook/`).

---

## 6. Infrastructure

### Hosting and code

- **Vercel:** account `thehashirsukhera-8511`, project `mjazo`, production address https://mjazo.vercel.app.
  - Redeploy with `npx vercel deploy --prod --yes` from `website/`.
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
| `CMS_MFA_REQUIRED` | Two-step sign-in for Owners and Admins (on unless `false`) | Not set (on) |
| `OPS_PASSCODE`, `SESSION_SECRET` | Turning on `/ops` and `/pro` | Not set |
| `CRON_SECRET` (plus a 5-minute pinger) | Safety Guardian, scheduled publishing and the weekly SEO check | Not set |
| `RESEND_API_KEY`, `OPS_EMAIL`, `OPS_FROM` | Emailing every submission to the team | Not set |
| `WHATSAPP_*` | Concierge on WhatsApp | Not set |
| `STT_API_KEY` | WhatsApp voice notes | Not set |
| `PAGESPEED_API_KEY` | More PageSpeed audits (optional) | Not set |

---

## 7. Setup checklist for the owner

1. ~~Supabase project, migrations, settings in Vercel, Owners, sign-in URLs, deploy~~ Done on 5 October 2026.
2. **Rotate the pasted secrets:** create a new Supabase secret key, put it in Vercel as `SUPABASE_SERVICE_ROLE_KEY` and delete the old one. Also reset the database password; the site doesn't use it.
3. Add an SMTP sender in Supabase (Authentication → Emails) before inviting the team: the built-in email only sends a few an hour. Then invite the team from People & roles and share the handbook PDF.
4. Set `OPS_PASSCODE` and `SESSION_SECRET` to turn on the staff tools.
5. Set `CRON_SECRET`. Point an external 5-minute pinger at `/api/cron/safety` and `/api/cron/cms-publish`. The weekly SEO check runs by itself (a Vercel cron in `vercel.json`), once `CRON_SECRET` is set.
6. Optionally set `RESEND_API_KEY` and the `OPS_*` emails, the WhatsApp Cloud API settings, `STT_API_KEY` and `PAGESPEED_API_KEY`.
7. Deploy (`npx vercel deploy --prod` from `website/`) after checking `npx vercel whoami`.
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

1. **Owner setup:** section 7 (rotate secrets, SMTP, `CRON_SECRET` and pingers, staff tool passcodes).
2. **Interface text still in code:**
   - inside the AI tools (Ghar Scan, Home Pulse, Glam Mirror, Shaadi planner, Concierge)
   - account screens, offer buttons and the partner flow
   - move it into "Buttons & labels", with Urdu
3. **Re-test the live flows** that need Supabase: booking → ops console, apply → interview, complaint → Trust Desk.
4. **Urdu content:** the AI translation pass, a human review, then switching on the Urdu site.
5. **Founder confirmations:** section 8 (contact details, prices, policies, legal text).
6. **Brand:** the open decisions in section 4.

---

## 10. Notes for developers

- **Content lives in the CMS.** Built-in defaults are in `lib/catalog.ts`, `lib/content.ts`, `lib/site.ts` and the types in `lib/cms/types/*`. Pages read it with `getPage()`, `getCatalog()`, `getContent()`, `getSettings()` and `getUi()`. Client components use `useCatalog()`, `useSite()`, `useNav()` and `useT()`.
- **Every page under `app/[locale]`** must call `await pageLocale(params)` first, in both the page and `generateMetadata`.
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
- **Checks before pushing:** `npx tsc --noEmit`, then `npm test` (191 tests), then `npx next build` (828 pages, plus two per published block page).
