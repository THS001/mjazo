# Mjazo CMS: build status

_Last updated 4 October 2026. Code: https://github.com/THS001/mjazo (branch `main`)._

The CMS at `/admin` lets the team and the client edit everything on mjazo.vercel.app without code
changes: text, prices, images, menus, SEO, and the Urdu site. It is built into the Next.js site and
stores content in Supabase. The work is split into seven phases; each one keeps the public site
looking the same while making more of it editable.

| Phase | What it covers | Status |
|---|---|---|
| 1. Foundation | Accounts and roles, the admin shell, drafts, publishing, history, the catalogue | Done, deployed |
| 2. Editors | Every page, page templates, menus, blog, help, legal | Done (deploy not confirmed) |
| 3. Media | Media library, image slots, hero video, 3D models | Done, not deployed |
| 4. Urdu | `/ur` site, right-to-left layout, translation tools | Done, not deployed |
| 5. SEO | SEO fields, metadata, redirects, SEO score, dashboard | About 70% done |
| 6. Page builder | New pages from blocks, live preview, click-to-edit | Not started |
| 7. Hardening | Tests, permission audit, backup, performance, team handbook | Not started |

Until Supabase is connected, nothing saved in `/admin` is kept on the live site: the site shows
its built-in content, and the admin says so at the top. Locally, edits are saved to `.data/` on the
developer's computer.

---

## Before anything persists: setup the owner must do

These need the owner's accounts and keys. The code is ready for all of them.

1. **Create a Supabase project** and add these to Vercel (Project → Settings → Environment Variables):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. **Run the database migrations** in the Supabase SQL editor, in order: `supabase/migrations/0001` to `0004`.
   - `0004_cms.sql` creates the CMS tables (entries, versions, users, media, redirects, SEO reports, audit log).
   - It also creates the public `media` storage bucket.
3. **Set `CMS_OWNER_EMAIL`**. That person signs in first, then invites everyone else from `/admin/people`.
4. **Scheduled publishing:** set `CRON_SECRET`. Point a 5-minute pinger at `/api/cron/cms-publish`, using the same secret as the Safety Guardian pinger.
5. **Optional:** set `PAGESPEED_API_KEY` for more PageSpeed audits per day.
6. **Deploy** with `npx vercel deploy --prod` from `website/`, after checking the right Vercel account with `npx vercel whoami`.
   - Phases 3 to 5 are not live yet.
   - Claude's production deploys are blocked by its safety system, so the owner deploys.

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

## Phase 5: SEO. In progress (about 70%)

**Done (in the code, committed)**

- **SEO group** on every page and every world, category, service, area, post, help topic and legal page: title, description, focus keyword, share image, "hide from search engines" and canonical address. Today's titles and descriptions are the starting values, so they are editable and translatable.
- **Settings → SEO settings** (`lib/cms/types/seo.ts`):
  - title ending, fallback title and description, keywords
  - a site-wide indexing switch, the paths robots shouldn't crawl
  - Google and Bing verification codes
  - title patterns, in English and Urdu, for world, category, service, area and help pages
- **One metadata helper for every route** (`lib/cms/seo/metadata.ts`):
  - canonical address in the page's language
  - hreflang once the Urdu site is on
  - share images, and noindex rules
- **`robots.txt` and the sitemap:** both follow the SEO settings, and hidden pages are left out.
- **SEO role:** can edit and publish SEO fields only; the server rejects any other change from it.
- **Redirects** (`lib/cms/redirects.ts`, `lib/cms/redirect-rules.ts`):
  - applied in `proxy.ts` for both languages
  - `/old/*` wildcards, and a check against loops and staff paths
  - **automatic redirect** when a published item's address changes
- **SEO score (0–100)** (`lib/cms/seo/score.ts`, with tests). 16 weighted checks on the real page HTML:
  - title and description length
  - focus keyword in the title, H1, description, opening text and address
  - one H1 and heading order
  - internal links, image alt text and amount of content
  - readability (Flesch, English only)
  - share image, and whether the page can be indexed
- **Server actions** (`app/(staff)/admin/seo-actions.ts`), plus report storage (`lib/cms/seo/reports.ts`) and the list of auditable pages (`lib/cms/seo/pages.ts`):
  - audit a page, and run Google PageSpeed
  - check suspected broken links
  - AI title, description and keyword suggestions
  - manage redirects

**Left in phase 5**

1. **SEO dashboard at `/admin/seo`:**
   - every page with its score and top issues, plus "Audit all" with progress
   - PageSpeed per page, and filters by section and language
   - site-wide panels: duplicate titles and descriptions, broken internal links, orphan pages, and a link to the Urdu coverage
2. **Redirects screen at `/admin/redirects`:** list, add, edit and delete, a "where does this address go?" tester, and hit counts.
3. **SEO group in the editor:**
   - a live Google result preview and a WhatsApp/social card preview
   - live length and keyword checks
   - a "Suggest with AI" button
   - a link to the page's latest SEO report
4. **Sidebar links** for SEO and Redirects.
5. **Tests** for redirect matching and loop detection, and for the SEO-role permission rules.
6. **Checks:** run in the browser, do a production build, commit and push.
7. **Optional:** a weekly PageSpeed run on the main pages.

---

## Phase 6: Block page builder and click-to-edit. Not started

1. **A new field kind for blocks:** a list where each item picks a block type and has that type's fields. It gets validation, the admin editor (add, reorder, duplicate, remove) and translation support.
2. **"Block page" collection:** new pages at any address, each with its own SEO group, served by the `[...slug]` route that currently shows the 404 page. Published pages go in the sitemap.
3. **Blocks**, built from existing site components:
   - hero, rich text, image and text, card grid
   - a services rail (chosen from the catalogue), FAQ, a call-to-action band
   - the promises strip, stats, video, gallery, an enquiry form, a spacer
4. **Live preview in the editor:**
   - the real page beside the form, refreshing after each autosave
   - phone and desktop widths, English and Urdu
5. **Click-to-edit:** clicking text in the preview jumps to its field in the form. It matches on the text itself, plus `data-cms` markers on blocks.

---

## Phase 7: Hardening. Not started

1. **Tests:**
   - the full permission matrix (every role against every action)
   - export and import round trip, scheduled publishing
   - slug-change redirects
   - the read-layer fallbacks for every type
2. **Permission audit:** every server action and route handler re-checked, including media upload, preview, cron and the SEO actions.
3. **Backup:** a full JSON export of all content, media records and redirects, and an import (Owner only) recorded in history.
4. **Two-step sign-in (MFA)** for Owners and Admins, carried over from phase 1.
5. **History diff view**, carried over from phase 2.
6. **Performance:**
   - check build time with both languages (826 pages now)
   - check the page size the catalogue adds to each page
   - check cache tags refresh only what changed
7. **Team handbook:** a short PDF in the Mjazo brand style on how to edit, publish, translate, add media, read the SEO score and manage redirects.

---

## Checks and tests

- `npx tsc --noEmit`: clean.
- `npm test`: 81 tests pass. They cover:
  - every content type's built-in content validating against its fields, and round-tripping unchanged
  - shipped Urdu
  - media type and content checks, size limits and image lookup
  - translation plumbing
  - the SEO score
  - catalogue helpers and roles
- `npx next build`: passes (last run at the end of phase 4).

## Commits

| Commit | What |
|---|---|
| Baseline | Phase 1 live, plus the start of phase 2 |
| Phase 2 | Remaining pages, templates and menus editable |
| Phase 3 | Media library, image slots, hero video, 3D models |
| Phase 4 | Urdu site, right-to-left layout, translation tools |
| Phase 5 (in progress) | SEO fields, metadata, redirects, SEO score |
| Status | This document, `.env.example` and cleanup |
