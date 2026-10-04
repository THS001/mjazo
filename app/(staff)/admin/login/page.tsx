import { redirect } from "next/navigation"
import { authMode, getCmsUser } from "@/lib/cms/auth"
import { LoginForm } from "@/components/admin/login"

export const metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCmsUser()) redirect("/admin")
  const sp = await searchParams
  return (
    <div className="grid min-h-screen bg-[#F4F4F2] lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16">
        <LoginForm mode={authMode()} linkError={sp.error === "link"} />
      </div>
      <div className="relative hidden overflow-hidden bg-foreground lg:block">
        <span aria-hidden className="absolute -bottom-10 -left-4 select-none font-bold leading-none tracking-tighter text-white/[0.06] text-[16rem]">
          CMS
        </span>
        <div className="absolute inset-0 flex flex-col justify-end p-16 text-white">
          <p className="font-serif text-5xl leading-tight">
            Every word, price and page.
            <br />
            <em className="text-brand">One place.</em>
          </p>
          <p className="mt-4 max-w-sm text-white/60">Edit services, prices, pages and settings, preview them on the real site, then publish.</p>
        </div>
      </div>
    </div>
  )
}
