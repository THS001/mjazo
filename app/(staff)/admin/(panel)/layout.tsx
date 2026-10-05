import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getCmsUser } from "@/lib/cms/auth"
import { navGroups } from "@/lib/cms/meta"
import { backend } from "@/lib/cms/store"
import { AdminShell } from "@/components/admin/shell"

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getCmsUser()
  if (!user) redirect("/admin/login")
  if (user.mfa && user.mfa !== "ok") redirect("/admin/two-step")
  const nav = navGroups().map((g) => ({ group: g.group, types: g.types.map(({ type, label, plural, kind, icon }) => ({ type, label, plural, kind, icon })) }))
  return (
    <AdminShell nav={nav} user={{ name: user.name, email: user.email, role: user.role }} backend={backend()}>
      {children}
    </AdminShell>
  )
}
