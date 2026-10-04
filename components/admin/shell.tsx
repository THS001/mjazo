"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, ExternalLink, ImageIcon, LayoutDashboard, LogOut, Menu, UserRound, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROLE_INFO, type Role } from "@/lib/cms/roles"
import type { TypeMeta } from "@/lib/cms/meta"
import { signOutAction } from "@/app/admin/actions"
import { AdminIcon } from "./ui"

type Nav = { group: string; types: Pick<TypeMeta, "type" | "label" | "plural" | "kind" | "icon">[] }[]
export type ShellUser = { name: string; email: string; role: Role }

export function AdminShell({ nav, user, backend, children }: { nav: Nav; user: ShellUser; backend: "supabase" | "local" | "none"; children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const item = (href: string, label: string, icon: ReactNode, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors", active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5")}
      >
        {icon}
        <span className="truncate">{label}</span>
      </Link>
    )
  }
  const sidebar = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-5">
      <Link href="/admin" className="flex items-center gap-2 px-3 text-white">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <path d="M8 21v-6.5l4 3.5 4-3.5V21" />
          <circle cx="18.5" cy="5.5" r="1.6" fill="#F4A437" stroke="none" />
        </svg>
        <span className="font-medium tracking-tight">Mjazo CMS</span>
      </Link>
      <div className="space-y-0.5">
        {item("/admin", "Dashboard", <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} />, true)}
        {item("/admin/media", "Media", <ImageIcon className="w-4 h-4" strokeWidth={1.75} />)}
      </div>
      {nav.map((g) => (
        <div key={g.group} className="space-y-0.5">
          <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-white/35">{g.group}</p>
          {g.types.map((t) => item(`/admin/c/${t.type}`, t.kind === "collection" ? t.plural : t.label, <AdminIcon name={t.icon} className="w-4 h-4" />))}
        </div>
      ))}
      <div className="space-y-0.5">
        <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-white/35">Team</p>
        {item("/admin/people", "People & roles", <Users className="w-4 h-4" strokeWidth={1.75} />)}
        {item("/admin/activity", "Activity log", <Activity className="w-4 h-4" strokeWidth={1.75} />)}
      </div>
      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
        <Link href="/admin/account" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-white/5">
          <span className="grid w-8 h-8 place-items-center rounded-full bg-brand text-foreground text-xs font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-white">{user.name}</span>
            <span className="block text-[11px] text-white/45">{ROLE_INFO[user.role].label}</span>
          </span>
          <UserRound className="ml-auto w-4 h-4 text-white/35" />
        </Link>
        <div className="flex gap-1 px-1">
          <a href="/" target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] text-white/60 hover:bg-white/5 hover:text-white">
            <ExternalLink className="w-3.5 h-3.5" /> View site
          </a>
          <form action={signOutAction} className="flex-1">
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] text-white/60 hover:bg-white/5 hover:text-white">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  )
  return (
    <div className="min-h-screen bg-[#F4F4F2] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-foreground lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-foreground">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-60">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-[#F4F4F2]/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="grid w-9 h-9 place-items-center rounded-full hover:bg-black/5" aria-label="Open menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-medium">Mjazo CMS</span>
        </div>
        {backend !== "supabase" && (
          <div className={cn("px-4 py-2 text-center text-xs sm:px-8", backend === "local" ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-800")}>
            {backend === "local"
              ? "Local development: changes are saved to .data/cms on this computer, not to the live site."
              : "Supabase isn't connected, so changes can't be saved. The site is showing its built-in content."}
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
