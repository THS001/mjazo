"use client"

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { JobStatus, SafetyLevel } from "@/lib/ops/types"

// Shared bits for the staff apps (ops console, pro app).

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function api<T = Record<string, unknown>>(url: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(url, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) window.dispatchEvent(new Event("mjazo:staff-logout"))
  if (!res.ok) throw new ApiError(data?.error ?? "Something went wrong", res.status)
  return data as T
}

/** Poll `fn` every `ms` while the tab is visible (and once when it becomes visible again). */
export function usePoll(fn: () => unknown, ms: number, deps: unknown[] = []) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    ref.current()
    const id = setInterval(() => document.visibilityState === "visible" && ref.current(), ms)
    const vis = () => document.visibilityState === "visible" && ref.current()
    document.addEventListener("visibilitychange", vis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", vis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps])
}

export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  new: { label: "Unassigned", cls: "bg-zinc-100 text-zinc-700" },
  assigned: { label: "Assigned", cls: "bg-sky-100 text-sky-800" },
  en_route: { label: "On the way", cls: "bg-indigo-100 text-indigo-800" },
  checked_in: { label: "In service", cls: "bg-[var(--brand-soft)] text-[var(--brand-ink)]" },
  checked_out: { label: "Finishing", cls: "bg-amber-100 text-amber-800" },
  completed: { label: "Done", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-400 line-through" },
}

export const SAFETY: Record<SafetyLevel, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "" },
  late: { label: "Late", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  overdue: { label: "Overdue", cls: "bg-orange-100 text-orange-900 border-orange-300" },
  escalated: { label: "No reply", cls: "bg-red-100 text-red-900 border-red-300" },
  sos: { label: "SOS", cls: "bg-red-600 text-white border-red-700" },
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", className)}>{children}</span>
}

type BtnProps = ComponentProps<"button"> & { variant?: "dark" | "light" | "brand" | "danger" | "ghost"; busy?: boolean; size?: "sm" | "md" | "lg" }
export function Btn({ variant = "dark", busy, size = "md", className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color,opacity] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" ? "h-9 px-3.5 text-[13px]" : size === "lg" ? "h-14 px-6 text-base" : "h-11 px-5 text-sm",
        variant === "dark" && "bg-black text-white hover:bg-zinc-800",
        variant === "light" && "bg-white text-black border border-black/10 hover:border-black/30",
        variant === "brand" && "bg-[var(--brand)] text-black hover:brightness-105",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "text-current hover:bg-black/5",
        className,
      )}
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

export const ago = (iso: string, now = Date.now()) => {
  const m = Math.round((now - new Date(iso).getTime()) / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })

/** wa.me link for a Pakistani mobile in 03xx form. */
export const waTo = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(text)}`

export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

export function Empty({ title, body, className }: { title: string; body?: string; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-dashed border-black/15 p-8 text-center", className)}>
      <p className="font-medium">{title}</p>
      {body && <p className="text-sm text-zinc-500 mt-1.5 max-w-md mx-auto">{body}</p>}
    </div>
  )
}

/** Plain PKR amount (formatPKR shows "On request" for 0, which is wrong for money collected). */
export const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-PK")}`
