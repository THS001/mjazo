// CMS roles and what each may do. Checked on the server for every action (lib/cms/auth.ts) and
// used by the admin UI to hide controls a person can't use.

export const ROLES = ["owner", "admin", "editor", "author", "seo", "viewer"] as const
export type Role = (typeof ROLES)[number]

export type Perm =
  | "view" // open the admin and preview drafts
  | "edit" // change content (drafts)
  | "publish" // make changes live, schedule, reorder, delete
  | "prices" // change prices (price fields)
  | "settings" // site settings (contact, policy, flags, search)
  | "review" // approve items an Author submitted
  | "seo" // SEO fields, redirects, audits
  | "media" // upload and edit media
  | "media.delete"
  | "users" // invite people, change roles

export const ROLE_INFO: Record<Role, { label: string; summary: string; perms: Perm[] }> = {
  owner: { label: "Owner", summary: "Everything, including people and roles.", perms: ["view", "edit", "publish", "prices", "settings", "review", "seo", "media", "media.delete", "users"] },
  admin: { label: "Admin", summary: "All content, prices, settings and publishing. Can invite people (not Owners).", perms: ["view", "edit", "publish", "prices", "settings", "review", "seo", "media", "media.delete", "users"] },
  editor: { label: "Editor", summary: "Edit and publish content. Not prices or site settings.", perms: ["view", "edit", "publish", "review", "seo", "media"] },
  author: { label: "Author", summary: "Write blog posts and help articles; an Editor publishes them.", perms: ["view", "edit", "media"] },
  seo: { label: "SEO", summary: "SEO fields, redirects and audits.", perms: ["view", "seo"] },
  viewer: { label: "Viewer", summary: "Read-only access and previews.", perms: ["view"] },
}

export const can = (role: Role | undefined | null, perm: Perm) => Boolean(role && ROLE_INFO[role].perms.includes(perm))

/** Content groups an Author may edit (everything else is read-only for them). */
export const AUTHOR_GROUPS = ["Blog", "Help"]
