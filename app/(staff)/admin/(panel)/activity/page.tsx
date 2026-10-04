import Link from "next/link"
import { listAudit } from "@/lib/cms/store"
import { typeMeta } from "@/lib/cms/meta"
import { Card } from "@/components/admin/ui"
import { when } from "@/lib/cms/format"

export const metadata = { title: "Activity log" }

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string; user?: string }> }) {
  const sp = await searchParams
  const rows = await listAudit({ limit: 300, type: sp.type, userId: sp.user })
  return (
    <div>
      <p className="text-xs text-zinc-500">Team</p>
      <h1 className="mt-1 font-serif text-3xl">Activity log</h1>
      <p className="mt-1 text-sm text-zinc-500">Every save, publish, schedule, restore and permission change, newest first.</p>
      {(sp.type || sp.user) && (
        <p className="mt-3 text-sm">
          Filtered.{" "}
          <Link href="/admin/activity" className="underline">
            Show everything
          </Link>
        </p>
      )}
      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">What</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const meta = a.type ? typeMeta(a.type) : null
                return (
                  <tr key={a.seq} className="border-t border-zinc-100 align-top">
                    <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{when(a.at)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {a.user_id ? (
                        <Link href={`/admin/activity?user=${a.user_id}`} className="hover:underline">
                          {a.user_name}
                        </Link>
                      ) : (
                        a.user_name
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.action}{" "}
                      {meta && a.entry_id && a.entry_id !== "*" ? (
                        <Link href={`/admin/c/${a.type}/${a.entry_id}`} className="font-medium hover:underline">
                          {a.title}
                        </Link>
                      ) : (
                        <b className="font-medium">{a.title}</b>
                      )}
                      {meta && (
                        <Link href={`/admin/activity?type=${a.type}`} className="ml-1 text-xs text-zinc-400 hover:underline">
                          {meta.label}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{a.detail}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="px-4 py-10 text-center text-sm text-zinc-500">No activity yet.</p>}
      </Card>
    </div>
  )
}
