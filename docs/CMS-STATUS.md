# Mjazo CMS: build status

_Last updated 5 October 2026 (phase 7, all phases done). Code: https://github.com/THS001/mjazo (branch `main`)._

The CMS at `/admin` lets the team and the client edit everything on mjazo.vercel.app without code
changes: text, prices, images, menus, SEO, and the Urdu site. It is built into the Next.js site and
stores content in Supabase. The work is split into seven phases; each one keeps the public site
looking the same while making more of it editable.

| Phase | What it covers | Status |
|---|---|---|
| 1. Foundation | Accounts and roles, the admin shell, drafts, publishing, history, the catalogue | Done, deployed |
| 2. Editors | Every page, page templates, menus, blog, help, legal | Done, deployed |
| 3. Media | Media library, image slots, hero video, 3D models | Done, deployed |
| 4. Urdu | `/ur` site, right-to-left layout, translation tools | Done, deployed |
| 5. SEO | SEO fields, metadata, redirects, SEO score, dashboard | Done, deployed |
| 6. Page builder | New pages from blocks, live preview, click-to-edit | Done, deployed |
| 7. Hardening | Tests, permission audit, backup, two-step sign-in, performance, team handbook | Done; the last fixes go out with the next deploy |

**Supabase is connected (5 October 2026).** Content saved in `/admin` now persists on the live site.
Both Owners (`CMS_OWNER_EMAIL`) can sign in, and the first has set up two-step sign-in. Locally,
without Supabase variables in `.env.local`, edits still go to `.data/` on the developer's computer.

The team handbook for editors is `docs/Mjazo-CMS-Team-Handbook.pdf` (10 pages). Its source is
`docs/handbook/handbook.html`; reprint it with `node docs/handbook/print.mjs`.

---

## Setup

**Done (5 October 2026):**

1. **Supabase project** `xjyafabyscamelebzrsb`. `node scripts/setup-supabase.mjs` ran migrations `0001` to `0004`, checked both keys and added the variables to Vercel production. The owner typed the database password and keys into the script; they're in no file. The script is safe to run again.
   - Vercel has `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `sb_publishable_` key) and `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_` key, stored as Secret).
   - `0004_cms.sql` created the CMS tables and the public `media` storage bucket.
2. **`CMS_OWNER_EMAIL`** = `mjazosupport@gmail.com,thehashirsukhera@gmail.com`. An Owner's first "Email me a sign-in link" creates their sign-in account, so nobody makes logins in Supabase.
3. **Supabase → Authentication → URL Configuration:** Site URL `https://mjazo.vercel.app`, Redirect URL `https://mjazo.vercel.app/**`.
4. **Deployed** to production with Supabase, and checked: `/admin` asks for sign-in, the backup download is refused when signed out, and an Owner signed in and set up two-step sign-in.

**Still to do (owner):**

1. **Rotate the pasted secrets.** The `sb_secret_` key and the database password were pasted into a chat. Create a new secret key (Supabase → Project Settings → API Keys), put it in Vercel as `SUPABASE_SERVICE_ROLE_KEY`, delete the old one, and reset the database password (the site never uses it).
2. **Scheduled publishing and the weekly SEO check:** set `CRON_SECRET` in Vercel (a long random string). Then point a 5-minute pinger (for example cron-job.org) at `GET /api/cron/cms-publish` with the header `Authorization: Bearer <CRON_SECRET>`. The weekly SEO check needs no pinger: `vercel.json` schedules it and Vercel sends the secret. Until then, a scheduled publish doesn't go out by itself.
3. **Email for invites:** Supabase's built-in email only sends a few messages an hour. Before inviting the whole team, add an SMTP sender under Supabase → Authentication → Emails.
4. **Optional:** set `PAGESPEED_API_KEY` for more PageSpeed audits per day.
5. **Deploys:** `npx vercel deploy --prod` from `website/`, after checking `npx vercel whoami` shows thehashirsukhera-8511.

`ANTHROPIC_API_KEY` is already set on Vercel (production). It powers the AI translation, alt text
and SEO suggestions in the admin. `.env.example` lists every variable with a comment.

---

## Phase 1: Foundation. Done, deployed

**What it does**

- **Sign-in:** Supabase Auth, with email and password or a magic link. Owners invite people by email.
- **Roles:** Owner, Admin, Editor, Author, SEO and Viewer. Every server action checks permissions (`lib/cms/roles.ts`, `lib/cms/auth.ts`).
- **Locally without Supabase:** there's a "Continue as local Owner" button. It never works in production.
- **Field definitions:** each content type is declared once (`lib/cms/fields.ts`, `lib/cms/registry.ts`). Validation, the admin form, defaults and the read layer all come from that one declaration.
- **Drafts and publishing:** autosave, a conflict warning when two people edit at once, publish, scheduled publish, hide and restore, drag to reorder.
- **History:** a version on every publish and manual save, with one-click restore. There's also an activity log (`lib/cms/write.ts`, `lib/cms/store.ts`).
- **Read layer:** published content is cached per type and merged over the built-in content. If the database is down or an entry is invalid, the site falls back to the built-in content (`lib/cms/read.ts`).
- **Catalogue:** worlds, categories, 132 services, areas and bundles, plus the site settings, are all editable. Client components get them through `CmsProvider`.

**Left from the original plan**

- **Two-step sign-in (MFA) for Owners and Admins.** Not built. Supabase supports TOTP; it needs an enrol screen and a check in `requireCms`.

---

## Phase 2: Editors. Done

**What it does**

- **Designed pages:** every page has its own editable content type, including home, about, careers, business, how it works, safety, contact, complaint, Plus, refer, offers, gift cards, the app page, weddings, the Shaadi Orchestrator, Ghar Scan, Home Pulse, Glam Mirror, the services menu and the Karachi page (`lib/cms/types/pages/*`).
- **Shared templates:** one each for world, category, service and area pages. Per-item tokens such as `{{area}}`, `{{world}}` and `{{category}}` fill in per page, so one edit changes all 8 areas or all 132 services.
- **Tokens:** `{{policy.freeChangeHours}}`, `{{plus.priceText}}`, `{{catalog.areaCount}}` and similar keep numbers in sync with Settings.
- **Blog, help centre and legal pages:** rich text (TipTap) rendered through an allowlist. The "last updated" date is stamped on publish.
- **Header and footer:** menu links, mobile tabs, footer columns, the join banner and the copyright line (`lib/cms/types/nav.ts`).
- **Italic accent words:** `*asterisks*` in a headline show the italic accent style.
- **Preview:** an editor can see drafts on the real page (Next draft mode), with a "Preview" bar showing.

**Verified:** the text on 26 pages matched the live site word for word. The only deliberate change: service pages for technicians and carers say "Your pro arrives" instead of "She arrives".

**Left**

- **Diff view in history:** versions can be restored, but not compared side by side yet.
- **Text inside the interactive tools is still in the code:** Ghar Scan, Home Pulse, Glam Mirror, the Shaadi planner, the Concierge chat, account screens, the offer buttons and the partner sign-up flow. These are mostly buttons and messages; they would join "Buttons & labels".

---

## Phase 3: Media. Done, not deployed

**What it does**

- **Media library at `/admin/media`:**
  - Drag-and-drop multi-upload, sent straight from the browser to Supabase Storage with signed URLs, so big files don't hit Vercel's size limit.
  - Limits by type: images 10 MB, video 50 MB, GLB models 25 MB, PDF 10 MB.
  - SVG is blocked, and every file's first bytes are checked against its type.
  - Alt text in English and Urdu, with an "AI suggestion" button.
  - Focal point (click the important spot), tags, "where it's used", replace in place.
  - Delete is blocked while a file is in use (`lib/cms/media.ts`, `components/admin/media.tsx`).
- **Image fields store the media item's id.** The site always shows the current file, alt text and focal point, so replacing a file updates every page using it.
- **Image slots, each falling back to today's icon and tint:**
  - category heading
  - service page and service cards
  - home page world tiles
  - blog covers
  - the hero on 14 pages
- **Home hero video:** chosen from the library.
- **World pages:** can show a 3D model (GLB). It's auto-sized, and the built-in object shows if the model fails.
- **Image optimisation:** `next/image` serves AVIF/WebP versions with a colour placeholder while loading.

**Verified:** locally, a test image went through the whole cycle: upload, set alt text, set as a service photo and publish, served through Next's image optimiser, "where used" shown, delete blocked. Then it was removed and deleted.

**Left**

- **Untested on Supabase.** Uploads have only been tested in local mode; test the Supabase path once it's connected.
- **Not checked visually:** 3D model rendering. The window was minimised during testing.
- **AI alt text:** test it once the admin runs with the API key.

---

## Phase 4: Urdu and right-to-left. Done, not deployed

**What it does**

- **Routing:**
  - English stays at the plain addresses (`/services`); Urdu lives under `/ur` (`/ur/services`).
  - `proxy.ts` maps addresses, and `/en/...` redirects to the plain address.
  - Public pages live in `app/[locale]`; the staff apps (`/admin`, `/ops`, `/pro`) have their own layout in `app/(staff)`.
- **Locale everywhere:** every page registers its locale first, and all CMS readers follow it (`lib/cms/locale.ts`).
- **Right-to-left layout:**
  - `lang` and `dir` are set on the page, with Nastaliq typography and taller line heights.
  - Left/right CSS classes were converted to start/end, so they mirror in Urdu. Directional icons flip.
  - The demo phone and the scrolling rows stay left-to-right.
  - Animated headlines move word by word in Urdu, because the letters join.
- **"Buttons & labels" (`lib/cms/types/ui.ts`):** about 200 interface strings with hand-written Urdu. They cover cards, cart, search, the area picker, forms, the category menu, the booking box, checkout, booking confirmation and sign-in. Urdu dates, durations and arrival windows display too.
- **Shipped Urdu:** for the header, mobile tabs and footer.
- **Translation tools:**
  - Each editor shows Urdu coverage, with "Translate the rest with AI", "Mark AI Urdu as reviewed" and "Retranslate everything".
  - `/admin/translate` shows coverage across the whole site, with a one-click "Translate everything missing" (saved as drafts, or published straight away).
  - AI translations are flagged "needs review" until a person checks them.
- **Urdu site switch** (Settings → Feature switches → "Urdu site (/ur) public"):
  - Shows the language switch, adds hreflang and Urdu sitemap entries, and lets Google index `/ur`.
  - Until then `/ur` works for editors to preview but is hidden from search.

**Verified:**

- 56 pages (28 in each language) returned 200, with no leftover tokens.
- English text was unchanged.
- `/ur` was checked in the browser.
- The production build pre-rendered 826 pages.

**Left**

- **The Urdu content itself:**
  - Page text, the catalogue, the blog and help need the AI translation pass (`/admin/translate`). That needs Supabase and the API key.
  - Then a person reviews it, and only then is the Urdu site switched on.
- **Interactive tools' interface text** (see phase 2) stays English on `/ur`.
- **A full visual check of every page in Urdu** at phone and desktop widths, once the Urdu text exists.

---

## Phase 5: SEO. Done, not deployed

**What it does**

- **SEO group** on every page and every world, category, service, area, post, help topic and legal page: title, description, focus keyword, share image, "hide from search engines" and canonical address. Today's titles and descriptions are the starting values, so they are editable and translatable.
- **Settings → SEO settings** (`lib/cms/types/seo.ts`):
  - title ending, fallback title and description, keywords
  - a site-wide indexing switch, the paths robots shouldn't crawl
  - Google and Bing verification codes
  - title patterns, in English and Urdu, for world, category, service, area and help pages
- **One metadata helper for every route** (`lib/cms/seo/metadata.ts`):
  - canonical address in the page's language
  - hreflang once the Urdu site is on
  - noindex rules
  - share images: the SEO image, else the page's own image, else the default from SEO settings, else the generated Mjazo card. Service pages keep their own generated card (`card: true`). Before this fix, pages without an image shared no picture at all, because a page's own `openGraph` replaces the card it would inherit.
- **`robots.txt` and the sitemap:** both follow the SEO settings, and hidden pages are left out.
- **SEO role:** can edit and publish SEO fields only; the server rejects any other change from it. The rules live in `lib/cms/field-perms.ts` and are tested role by role. Authors see SEO fields locked instead of getting an error on save.
- **Redirects** (`lib/cms/redirect-match.ts` for matching and checks, `lib/cms/redirects.ts` for saving, `lib/cms/redirect-rules.ts` for reading):
  - applied in `proxy.ts` for both languages, keeping the query string
  - `/old/*` wildcards; refuses loops (including through wildcards and the built-in redirects), staff paths, the home page and clashes with the built-in redirects
  - **automatic redirect** when a published item's address changes. Older redirects are pointed straight at the newest address (no chains). Changing an address back removes the redirect that would now loop.
  - the redirects built into the code (`lib/builtin-redirects.mjs`, used by `next.config.mjs`) show read-only in the admin
- **SEO score (0–100)** (`lib/cms/seo/score.ts`, with tests). Up to 16 weighted checks on the real page HTML (the keyword checks need a focus keyword):
  - title and description length
  - focus keyword in the title, H1, description, opening text and address
  - one H1 and heading order
  - internal links, image alt text and amount of content
  - readability (Flesch, English only)
  - share image, and whether the page can be indexed
  - Headlines animated letter by letter (`<span>` per letter) are read as whole words, as a browser shows them.
- **SEO dashboard at `/admin/seo`** (`components/admin/seo.tsx`):
  - all 383 pages: the 24 designed pages, 8 worlds, 22 categories, 132 services, 8 areas, 176 area pages (area × category), the blog, help and legal pages
  - each page's score, its top problems, when it was audited, and its full report (every check, what Google reads, PageSpeed)
  - "Audit all", or just the filtered pages, sent in batches with progress and a Stop button
  - filters by section, problems and audit state; search; sort by score or audit age; English and Urdu
  - Google PageSpeed per page, for phone or desktop. It tests the public address, takes up to a minute, and the result is kept with the report.
  - site-wide panels: duplicate titles and descriptions, broken internal links (a "Check links" button tests unknown addresses and flags redirecting links), orphan pages (once every page has a report), and Urdu coverage with a link to the translation tools
- **Redirects at `/admin/redirects`** (`components/admin/redirects.tsx`):
  - list, search, add, edit (including the old address) and delete
  - checks as you type: loops, clashes, a live page the redirect would hide, a destination that redirects again (with "Use … instead"), or an unknown destination
  - permanent (308) or temporary (307), a note, visit counts, who added it and when
  - a "where does this address go?" tester that shows every hop and whether the final page loads
  - the built-in redirects, read-only
- **SEO group in every editor** (`components/admin/seo-group.tsx`):
  - Google result and WhatsApp/social card previews, in English and Urdu. Empty fields show what the live page uses today.
  - live checks with the same thresholds as the score: title and description length, keyword in title and description, share image (warns about WebP and AVIF), hidden from search
  - "Suggest with AI" for the title, description and keyword, shortened to fit each field, with "Use" per field or "Use all three"
  - the page's latest score, linking to its report in the dashboard
- **Weekly SEO check** (`app/api/cron/seo-weekly`, scheduled in `vercel.json` for Mondays at 07:00 Karachi time). It re-audits every English page, then runs PageSpeed (phone) on the home page, the services menu, the 8 worlds, offers, Plus and Karachi. Vercel sends `CRON_SECRET` with the request; without it the route refuses to run.
- **Sidebar:** SEO and Redirects under Tools.
- **Server actions** (`app/(staff)/admin/seo-actions.ts`), with the audit code shared with the weekly check (`lib/cms/seo/audit.ts`), report storage (`lib/cms/seo/reports.ts`) and the list of auditable pages (`lib/cms/seo/pages.ts`).

**Verified**

- **The dashboard, locally:** 379 of 383 pages audited, average score 86; 338 good, 42 needing work, none poor. The 4 others hit dev-server errors during the run and load fine on their own.
- **Site-wide panels:** no duplicate titles or descriptions and no broken internal links. Nine designed pages are orphans, linked only from the menu and footer: Plus, How it works, Business, Gift cards, Refer, Get the app, About, Contact and Report a problem. Urdu coverage reads 15% (284 of 1,929 texts).
- **Redirects, end to end:** English, Urdu (`/ur/old` → `/ur/new`), query strings kept and visits counted. Also checked: the chain warning and its shortcut, refusal of a loop, editing the old address (the visit count is kept), delete, and the tester.
- **Editor SEO group** on a service, in English and Urdu: the live title and description load, the checks update as you type, the AI button explains the missing key locally, and the score links through.
- **Local data:** reports and redirects are written to a temporary file first, then swapped in, so a read never sees half a file.

**Left**

- **Untested against Supabase and the live site:** PageSpeed (it needs the public address) and AI suggestions (they need the API key in the admin's environment). Both run once phases 3 to 5 are deployed with Supabase connected.
- **The orphan pages above** need links from related pages' content. That's a content task, not code.

---

## Phase 6: Block page builder and click-to-edit. Done, not deployed

**What it does**

- **Block pages** (Pages → Block pages, `lib/cms/types/block-page.ts`): new pages at any free address, such as `/eid-sale` or `/campaigns/eid-sale`. Each has a name, a summary, its blocks and its own SEO group.
  - **Addresses:** one to four parts of lowercase letters, numbers and hyphens. The first part can't be one of the site's sections (`/services`, `/blog`…), a staff app, the API or a language prefix (`lib/cms/block-paths.ts`; a test keeps that list in step with `app/[locale]`). Addresses must be unique.
  - **Changing a published page's address** adds a redirect from the old one, in both languages, like other items.
  - **Served** by the `[...slug]` route, with metadata from the page's SEO group (its summary or the hero's intro and image when empty). Pages are listed in the sitemap and on the SEO dashboard (section "Block pages"). The Urdu version is at `/ur/…`.
- **A new field kind, `blocks`** (`lib/cms/fields.ts`): a list whose items are each one kind of block, stored as `{ _type, _key, …fields }`. Every layer handles it: validation (a discriminated union, with readable errors like "Blocks › Cards #2 › Columns"), the stored and site shapes, media lookup, Urdu coverage and the AI translation, the role rules (the SEO role can't change blocks), reference pickers and the AI SEO suggestions. A block kind that no longer exists is skipped on the site.
- **13 blocks**, built from the site's own components (`components/cms/blocks.tsx`, `blocks-client.tsx`):
  - Hero (`PageHero`), Text (rich text), Image and text, Cards (icon grid, links optional)
  - Services (picked, a whole category, or most booked; real bookable `ServiceCard`s), Questions (`FAQ`, with FAQ schema), Call to action
  - Promises strip, Numbers (tokens like `{{catalog.areaCount}}` work), Video (from the media library; silent loop or with controls), Gallery
  - Enquiry form (sent to the team like the site's other forms, as kind "page", with the page and form name; can ask for an area and a date), Spacer
  - Most blocks take a background (paper, ink, saffron, cream) and an anchor (`#enquire`) that buttons can link to. `*Asterisks*` give the italic accent.
  - Each new block starts with sample content, so the preview shows it straight away. Missing images and videos show a placeholder in preview and nothing on the live site.
- **The blocks editor** (`components/admin/fields.tsx`): add from a picker (with a description of each block), insert between blocks, drag to reorder, duplicate, remove, collapse; each block's header shows its first line of text.
- **Live preview beside every editor** (`components/admin/preview-panel.tsx`), not just block pages. "Live preview" in the editor's header (wide screens) puts the real page next to the form, in draft mode:
  - desktop (scaled to fit) or phone width, English or Urdu
  - it refreshes after every autosave without losing its scroll position, and scrolls to a block when you open it in the form
  - reload and open-in-a-new-tab buttons; the choice to show it is remembered on that computer
- **Click-to-edit** (`lib/cms/click-to-edit.ts`, `components/cms/preview-bridge.tsx`): with "Click to edit" on, clicking any text in the preview opens its field. Collapsed blocks and list items expand, the input is focused (the Urdu one in the Urdu preview) and briefly highlighted. Block pages mark every block and their main texts with `data-cms`; designed pages are matched on the text itself, allowing for `{{tokens}}` and `*accents*`. Text from elsewhere (header, footer) shows a short note instead. Turn it off to click links normally.

**Fixes made along the way**

- **New items 404'd after a deploy.** `app/[locale]/layout.tsx` had `dynamicParams = false`, and Next applies it to every page below, so any service, post, help topic, area or block page published after a deploy returned 404 until the next deploy. The build manifest showed `fallback: false` on those routes; it now shows `null` (rendered on first visit, then cached). The proxy only ever sends `en` or `ur`, so nothing relied on it.
- **Opening a rich-text field could change the entry.** An empty Urdu rich-text editor could report `{ type: "doc" }` (no content list). That made the entry fail validation ("Required"), or could leave a spurious draft. The editor now reports empty documents in one shape and ignores updates that change nothing, and the read side treats a document without content as empty.
- **Enquiry forms** take a `context` (sent with the details) and a new kind, `page`, which the submissions schema accepts.
- Two new labels in Buttons & labels, with Urdu: "Preferred date" and "Your area".

**Verified**

- A page was built in the admin from all 13 blocks, previewed live, published, and loaded at desktop and 375px phone width with no sideways scrolling. Its address was then changed, adding the redirect automatically.
- Click-to-edit found a card title in a nested list, a letter-by-letter animated headline, and (from the Urdu preview) the Urdu text box. Edits showed in the preview about 4 seconds after typing.
- A taken address (`/services/eid`) was refused with a clear message.
- In a production build, a built page answered 200, its old address 308, and never-built addresses 404.

**Left**

- **Not tried with real media:** the gallery, video and image blocks were only checked with their placeholders; nothing was uploaded for this test.

---

## Phase 7: Hardening. Done

**What it does**

- **Permission matrix tests** (`lib/cms/permissions.test.ts`): 31 actions × 6 roles, run against an in-memory store through the real server actions and routes. Also covers two-step sign-in, scheduling, saving and the hardening fixes below.
- **Permission audit:** every server action and route handler was re-checked. Fixed:
  - saving a draft needs an existing entry (new ones go through Create, which checks ids, slugs and addresses)
  - an edit by someone who can't publish it cancels a pending schedule, so it isn't published for them
  - the SEO role can only discard SEO changes
  - new items are checked field by field, like edits
  - reordering ignores unknown ids
  - the translation list respects type access
  - the SEO tools only accept paths on the site
  - a bug the matrix found: the SEO role couldn't save built-in items that had no SEO group yet
- **Backup** (Team → Backup, `lib/cms/backup.ts`, `/api/cms/backup`):
  - Owners and Admins download one JSON file: every saved entry (all statuses), media records and redirects.
  - Owners restore it **as drafts** (the live site doesn't change) or **exactly** (live content, schedules and hidden items too). Nothing is deleted. Each restored entry gets an "imported" version in its History, and entries that already match are left alone. Both downloads and restores go in the activity log.
- **Two-step sign-in** (`lib/cms/mfa.ts`, `/admin/two-step`): authenticator-app codes through Supabase Auth.
  - Required for Owners and Admins, optional for everyone else (Account).
  - Every admin page, server action and the preview route checks it.
  - Owners and Admins can reset it for others from People & roles (Admins can't reset Owners).
  - `CMS_MFA_REQUIRED=false` turns the requirement off during setup.
- **History compare** (`lib/cms/diff.ts`): any version against the form or the live version, field by field and word by word, then restore it.
- **Saving:** Ctrl+S (⌘S) saves now and keeps a version in History. Content that's back to exactly the live version clears the draft (`saveEdits`), so it no longer shows as "Unpublished changes".
- **Owners and setup:** `CMS_OWNER_EMAIL` takes several emails, and an Owner's first emailed sign-in link creates their account. `scripts/setup-supabase.mjs` sets up a Supabase project (migrations, key checks, Vercel variables).
- **Performance** (production build, 828 pages):
  - Build time: about 2 minutes on Vercel (compile 31 s, static pages 51 s); 5 to 6.5 minutes on this PC.
  - Page size: the catalogue the layout sends to the browser was 58.5 KB of each page's data (48 KB of it catalogue). Category FAQs and "not included" lists are only shown by server-rendered pages, so `browserCatalog()` leaves them out: now 44.9 KB. Compressed, that saves only about 1 KB, because the repeated FAQs compressed well. Home page data is now 88 KB (22 KB gzipped).
  - Cache tags: every page carries the catalogue and settings tags (the header, search and footer use them), so a price change refreshes every page. A page edit refreshes only its own tag (for example `cms:page-about`). Pages rebuild on their next visit, not all at once.
- **Team handbook:** `docs/Mjazo-CMS-Team-Handbook.pdf`, 10 A4 pages in the brand style. It covers signing in and roles, the admin map and statuses, editing and publishing, history and backups, block pages, media, Urdu, SEO and redirects, placeholders, house style and what to do when something goes wrong.

**Left**

- **Two-step sign-in in local development:** it can't be tried without Supabase. It was checked live by the first Owner, but its screen wasn't checked at phone width. The Backup screen was (375 px, no sideways scrolling).

---

## Checks and tests

- `npx tsc --noEmit`: clean.
- `npm test`: 191 tests in 17 files pass. They cover:
  - every content type's built-in content validating against its fields, and round-tripping unchanged
  - shipped Urdu
  - media type and content checks, size limits and image lookup
  - translation plumbing
  - the SEO score, including animated headlines
  - redirect matching, tracing, loop and clash checks (`redirect-match.test.ts`), plus saving, editing and slug-change redirects (`redirects.test.ts`)
  - what each role may change and publish, including the SEO role (`field-perms.test.ts`)
  - the blocks field through every layer, block page addresses, and every block's starting content (`blocks.test.ts`)
  - click-to-edit matching (`click-to-edit.test.ts`)
  - catalogue helpers and roles, including several Owner emails (`roles.test.ts`)
  - the permission matrix for every role, two-step sign-in, scheduling and saving (`permissions.test.ts`)
  - two-step sign-in rules (`mfa.test.ts`), backups (`backup.test.ts`) and the history compare (`diff.test.ts`)
  - built-in content as the fallback for every type when an entry is invalid or the database is down (`read.test.ts`)
- `npx next build`: passes (5 October 2026, phase 7). 828 pages, plus two per published block page (English and Urdu).

## Commits

| Commit | What |
|---|---|
| Baseline | Phase 1 live, plus the start of phase 2 |
| Phase 2 | Remaining pages, templates and menus editable |
| Phase 3 | Media library, image slots, hero video, 3D models |
| Phase 4 | Urdu site, right-to-left layout, translation tools |
| Phase 5 (in progress) | SEO fields, metadata, redirects, SEO score |
| Status | This document, `.env.example` and cleanup |
| Progress | `PROGRESS.md` for the whole project |
| Phase 5 | SEO dashboard, redirects screen, editor SEO previews, weekly check, tests |
| Phase 6 | Block pages, 13 blocks, live preview, click-to-edit; new items no longer 404 after a deploy |
| Phase 7 (part 1) | Permission fixes and matrix tests, backup, two-step sign-in, history compare, several Owners, Supabase setup script |
| Phase 7 | Team handbook, smaller browser catalogue, Ctrl+S versions, drafts equal to live are cleared, docs |
