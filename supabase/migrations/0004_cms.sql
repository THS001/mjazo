-- Mjazo CMS: content entries with drafts and publishing, version history, media, users and roles,
-- redirects, SEO reports and an audit log. Only the server (service role) touches these tables;
-- RLS is on with no policies, like ops_docs. Run after 0001–0003.

-- Content entries: one row per item (a service, a page, a setting group, ...).
-- `draft` holds unpublished changes; `published` is what the public site shows.
create table if not exists public.cms_entries (
  type          text not null,
  id            text not null,
  status        text not null default 'draft' check (status in ('draft', 'published', 'scheduled', 'archived')),
  draft         jsonb,
  published     jsonb,
  review        boolean not null default false,       -- submitted for review by an Author
  position      integer,                               -- order within a collection
  version       integer not null default 1,           -- optimistic locking: every write bumps it
  publish_at    timestamptz,                           -- scheduled publish time
  updated_by    text,
  updated_at    timestamptz not null default now(),
  published_by  text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  primary key (type, id)
);
create index if not exists cms_entries_type_idx on public.cms_entries (type, position);
create index if not exists cms_entries_scheduled_idx on public.cms_entries (publish_at) where status = 'scheduled';

-- Version history: a snapshot on every publish and every manual save, for compare and restore.
create table if not exists public.cms_versions (
  seq         bigserial primary key,
  type        text not null,
  entry_id    text not null,
  version     integer not null,
  kind        text not null check (kind in ('saved', 'published', 'restored', 'imported')),
  data        jsonb not null,
  note        text,
  user_id     text,
  user_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists cms_versions_entry_idx on public.cms_versions (type, entry_id, seq desc);

-- People who can sign in to /admin. `id` is the Supabase Auth user id.
create table if not exists public.cms_users (
  id          uuid primary key,
  email       text not null unique,
  name        text,
  role        text not null check (role in ('owner', 'admin', 'editor', 'author', 'seo', 'viewer')),
  active      boolean not null default true,
  invited_by  text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz
);

-- Media library. Files live in the public `media` storage bucket.
create table if not exists public.cms_media (
  id          text primary key,
  path        text not null unique,
  url         text not null,
  kind        text not null check (kind in ('image', 'video', 'model', 'file')),
  mime        text not null,
  size        integer not null,
  width       integer,
  height      integer,
  alt         jsonb,              -- { en, ur }
  focal       jsonb,              -- [x, y] in 0..1
  color       text,               -- dominant colour, used as a placeholder while loading
  tags        text[] not null default '{}',
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists cms_media_created_idx on public.cms_media (created_at desc);

-- Redirects, applied by proxy.ts. Old slugs redirect automatically when a slug changes.
create table if not exists public.cms_redirects (
  source      text primary key,   -- path, e.g. /services/old-slug
  destination text not null,
  permanent   boolean not null default true,
  hits        integer not null default 0,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- SEO and PageSpeed reports per page.
create table if not exists public.cms_seo_reports (
  seq         bigserial primary key,
  path        text not null,
  locale      text not null default 'en',
  score       integer,
  checks      jsonb,
  pagespeed   jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists cms_seo_reports_path_idx on public.cms_seo_reports (path, created_at desc);

-- Who changed what.
create table if not exists public.cms_audit (
  seq         bigserial primary key,
  at          timestamptz not null default now(),
  user_id     text,
  user_name   text,
  action      text not null,
  type        text,
  entry_id    text,
  title       text,
  detail      text
);
create index if not exists cms_audit_at_idx on public.cms_audit (at desc);

alter table public.cms_entries enable row level security;
alter table public.cms_versions enable row level security;
alter table public.cms_users enable row level security;
alter table public.cms_media enable row level security;
alter table public.cms_redirects enable row level security;
alter table public.cms_seo_reports enable row level security;
alter table public.cms_audit enable row level security;
-- No policies: only the service role (server) can read or write.

-- Public bucket for images, video and 3D models (read by anyone, written only by the server).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'model/gltf-binary', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
