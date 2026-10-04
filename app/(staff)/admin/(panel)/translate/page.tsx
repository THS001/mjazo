import { getCmsUser } from "@/lib/cms/auth"
import { can } from "@/lib/cms/roles"
import { aiEnabled } from "@/lib/ai/anthropic"
import { TranslateTool } from "@/components/admin/translate"

export const metadata = { title: "Urdu translation" }

export default async function TranslatePage() {
  const user = (await getCmsUser())!
  return (
    <div>
      <h1 className="font-serif text-3xl">Urdu translation</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-zinc-500">
        How much of the site has Urdu, and a one-click AI pass for everything still missing. The Urdu site at /ur goes public when you switch it on in Settings → Feature switches.
      </p>
      <TranslateTool canPublish={can(user.role, "publish")} aiReady={aiEnabled()} />
    </div>
  )
}
