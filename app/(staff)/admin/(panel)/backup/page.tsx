import { pageUser } from "@/lib/cms/auth"
import { can } from "@/lib/cms/roles"
import { writable } from "@/lib/cms/store"
import { BackupTool } from "@/components/admin/backup"

export const metadata = { title: "Backup" }

export default async function BackupPage() {
  const user = await pageUser()
  return (
    <div>
      <h1 className="font-serif text-3xl">Backup</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-zinc-500">Download a copy of all saved content, and bring one back if something goes wrong.</p>
      <BackupTool canExport={can(user.role, "settings")} canImport={can(user.role, "backup")} writable={writable()} />
    </div>
  )
}
