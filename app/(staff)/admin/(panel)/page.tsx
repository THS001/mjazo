import Link from "next/link"
import { ArrowRight, CircleCheck, CircleDashed } from "lucide-react"
import { getCmsUser } from "@/lib/cms/auth"
import { navGroups } from "@/lib/cms/meta"
import { ROLE_INFO } from "@/lib/cms/roles"
import { backend, listAudit } from "@/lib/cms/store"
import { adminList } from "@/lib/cms/write"
import { AdminIcon, Card, StateBadge } from "@/components/admin/ui"
import { ago } from "@/lib/cms/format"

export const metadata = { title: "Dashboard" }

export default async function Dashboard() {
  const user = (await getCmsUser())!
  const groups = navGroups()
  const lists = await Promise.all(groups.flatMap((g) => g.types.map(async (t) => ({ t, items: await adminList(t.type) }))))
  const pending = lists.flatMap(({ t, items }) => items.filter((i) => i.state === "changed" || i.state === "draft" || i.state === "scheduled" || i.review).map((i) => ({ ...i, type: t.type, label: t.label })))
  const audit = await listAudit({ limit: 12 })
  const be = backend()
  const setup = [
    { done: be === "supabase", label: "Supabase connected", hint: "Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then run migration 0004_cms.sql." },
    { done: Boolean(process.env.CMS_OWNER_EMAIL), label: "First Owner set", hint: "Add CMS_OWNER_EMAIL in Vercel: that person signs in first and invites the team." },
    { done: Boolean(process.env.CRON_SECRET), label: "Scheduled publishing", hint: "Add CRON_SECRET and point a 5-minute pinger at /api/cron/cms-publish." },
  ]
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-zinc-500">{ROLE_INFO[user.role].label}</p>
        <h1 className="mt-1 font-serif text-4xl">Hello, {user.name.split(" ")[0]}.</h1>
        <p className="mt-1 text-sm text-zinc-500">Everything on mjazo is editable here: services and prices, pages, settings and more. Changes go live when you publish.</p>
      </div>

      {setup.some((s) => !s.done) && (
        <Card className="p-5">
          <p className="font-medium">Finish setting up</p>
          <ul className="mt-3 space-y-2.5">
            {setup.map((s) => (
              <li key={s.label} className="flex gap-3 text-sm">
                {s.done ? <CircleCheck className="mt-0.5 w-4 h-4 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 w-4 h-4 shrink-0 text-zinc-400" />}
                <span>
                  <span className={s.done ? "text-zinc-500 line-through" : "font-medium"}>{s.label}</span>
                  {!s.done && <span className="block text-xs text-zinc-500">{s.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Waiting for you</h2>
        {pending.length ? (
          <Card className="divide-y divide-zinc-100">
            {pending.slice(0, 12).map((i) => (
              <Link key={`${i.type}/${i.id}`} href={`/admin/c/${i.type}/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-zinc-50">
                <span className="min-w-0">
                  <span className="font-medium">{i.title}</span> <span className="text-zinc-400">· {i.label}</span>
                  <span className="block text-xs text-zinc-500">{i.updatedAt ? `${ago(i.updatedAt)}${i.updatedBy ? ` by ${i.updatedBy}` : ""}` : ""}</span>
                </span>
                <StateBadge state={i.state} review={i.review} />
              </Link>
            ))}
          </Card>
        ) : (
          <Card className="px-4 py-6 text-sm text-zinc-500">No drafts, reviews or scheduled changes. Everything is published.</Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Content</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map(({ t, items }) => (
            <Link key={t.type} href={`/admin/c/${t.type}`} className="group">
              <Card className="flex h-full items-start gap-3 p-4 transition-colors group-hover:border-zinc-400">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                  <AdminIcon name={t.icon} className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.kind === "collection" ? t.plural : t.label}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {t.group}
                    {t.kind === "collection" ? ` · ${items.filter((i) => i.state !== "hidden").length} items` : ""}
                  </span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link href="/admin/activity" className="text-xs text-zinc-500 hover:text-foreground">
            See all
          </Link>
        </div>
        <Card className="divide-y divide-zinc-100">
          {audit.length ? (
            audit.map((a) => (
              <div key={a.seq} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <b className="font-medium">{a.user_name ?? "Someone"}</b> {a.action} <span className="text-zinc-600">{a.title}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400">{ago(a.at)}</span>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-zinc-500">Nothing yet.</p>
          )}
        </Card>
      </section>
    </div>
  )
}
