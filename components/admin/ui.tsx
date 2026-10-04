"use client"

import type { ComponentProps, ReactNode } from "react"
import {
  Activity,
  BookOpen,
  Building2,
  CalendarClock,
  Crown,
  FileText,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Scale,
  ScrollText,
  Search,
  Settings,
  Tag,
  ToggleRight,
  Users,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { State } from "@/lib/cms/write"

// Small building blocks for the CMS admin, in the Mjazo brand (ink, paper, one saffron accent).

export const ADMIN_ICONS: Record<string, LucideIcon> = {
  Activity,
  BookOpen,
  Building2,
  CalendarClock,
  Crown,
  FileText,
  Globe,
  HelpCircle,
  Image: ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Navigation,
  Package,
  Scale,
  ScrollText,
  Search,
  Settings,
  Tag,
  ToggleRight,
  Users,
}
export const AdminIcon = ({ name, className }: { name: string; className?: string }) => {
  const C = ADMIN_ICONS[name] ?? FileText
  return <C className={className} strokeWidth={1.75} />
}

type BtnProps = ComponentProps<"button"> & { variant?: "primary" | "brand" | "outline" | "ghost" | "danger"; size?: "sm" | "md"; busy?: boolean }
export function Btn({ variant = "outline", size = "md", busy, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-foreground text-background hover:bg-black/85",
        variant === "brand" && "bg-brand text-foreground hover:brightness-95",
        variant === "outline" && "border border-zinc-300 bg-white hover:border-foreground",
        variant === "ghost" && "hover:bg-black/5",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

const STATE_STYLE: Record<State, string> = {
  default: "bg-emerald-50 text-emerald-800",
  live: "bg-emerald-50 text-emerald-800",
  changed: "bg-brand-soft text-brand-ink",
  draft: "bg-zinc-100 text-zinc-600",
  scheduled: "bg-sky-50 text-sky-800",
  hidden: "bg-zinc-100 text-zinc-400 line-through",
}
const STATE_TEXT: Record<State, string> = { default: "Live", live: "Live", changed: "Unpublished changes", draft: "Draft", scheduled: "Scheduled", hidden: "Hidden" }

export function StateBadge({ state, review }: { state: State; review?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", STATE_STYLE[state])}>
        <span className={cn("w-1.5 h-1.5 rounded-full", state === "live" || state === "default" ? "bg-emerald-500" : state === "changed" ? "bg-brand" : state === "scheduled" ? "bg-sky-500" : "bg-zinc-400")} />
        {STATE_TEXT[state]}
      </span>
      {review && <span className="rounded-full bg-violet-50 text-violet-800 px-2.5 py-0.5 text-[11px] font-medium">In review</span>}
    </span>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-zinc-200 bg-white", className)}>{children}</div>
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "info" && "bg-zinc-100 text-zinc-700",
        tone === "warn" && "bg-brand-soft text-brand-ink",
        tone === "error" && "bg-red-50 text-red-800",
        tone === "ok" && "bg-emerald-50 text-emerald-800",
        className,
      )}
    >
      {children}
    </div>
  )
}

export { ago, when } from "@/lib/cms/format"
