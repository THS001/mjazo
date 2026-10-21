// Staff roles and what each may do in the CMS. One sign-in (Supabase + cms_users) serves both
// the CMS (/admin) and mission control (/ops). The website roles get CMS permissions here; the
// operations roles (Dispatcher, Support, Finance, Recruiter) get none, and their mission control
// permissions are in lib/ops/access.ts. Both are checked on the server for every action.

export const CMS_ROLES = ["owner", "admin", "editor", "author", "seo", "viewer"] as const
export const OPS_ROLES = ["dispatcher", "support", "finance", "recruiter"] as const
export const ROLES = [...CMS_ROLES, ...OPS_ROLES] as const
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
  | "backup" // import a backup (replaces content)

export const ROLE_INFO: Record<Role, { label: string; summary: string; perms: Perm[] }> = {
  owner: { label: "Owner", summary: "Everything, including people, roles, money approvals and restoring backups.", perms: ["view", "edit", "publish", "prices", "settings", "review", "seo", "media", "media.delete", "users", "backup"] },
  admin: { label: "Admin", summary: "All content, prices, settings and publishing, and mission control except money approvals. Can invite people (not Owners or Finance).", perms: ["view", "edit", "publish", "prices", "settings", "review", "seo", "media", "media.delete", "users"] },
  editor: { label: "Editor", summary: "Edit and publish content. Not prices or site settings.", perms: ["view", "edit", "publish", "review", "seo", "media"] },
  author: { label: "Author", summary: "Write blog posts and help articles; an Editor publishes them.", perms: ["view", "edit", "media"] },
  seo: { label: "SEO", summary: "SEO fields, redirects and audits.", perms: ["view", "seo"] },
  viewer: { label: "Viewer", summary: "Read-only access and previews.", perms: ["view"] },
  dispatcher: { label: "Dispatcher", summary: "Mission control: the board, assigning pros, Route Brain, bookings, pros' schedules.", perms: [] },
  support: { label: "Support", summary: "Mission control: the requests inbox, complaints, bookings (reschedule, cancel), asking for refunds and credits.", perms: [] },
  finance: { label: "Finance", summary: "Mission control: cash held, reconciliation, approving refunds and credits, payout runs, promo codes, KPIs.", perms: [] },
  recruiter: { label: "Recruiter", summary: "Mission control: recruiting, adding pros and their verification checklist.", perms: [] },
}

export const can = (role: Role | undefined | null, perm: Perm) => Boolean(role && ROLE_INFO[role]?.perms.includes(perm))

/** Roles only an Owner may give (they can approve money, or do everything). */
export const OWNER_GRANTED: Role[] = ["owner", "finance"]

/** The Owners named in CMS_OWNER_EMAIL: one email, or several separated by commas. */
export function ownerEmails(value = process.env.CMS_OWNER_EMAIL): string[] {
  return (value ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"))
}

/** Content groups an Author may edit (everything else is read-only for them). */
export const AUTHOR_GROUPS = ["Blog", "Help"]
