/** Where to go after signing in: a CMS or mission control page only (never another site). */
export const safeNext = (next: string | null | undefined) => (next && /^\/(admin|ops)(\/|$|\?)/.test(next) ? next : "/admin")
