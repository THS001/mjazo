"use client"

import { useState } from "react"
import { useRouter } from "@/components/site/locale-link"
import { Check, Loader2 } from "lucide-react"
import { useLocation } from "@/lib/store"
import { submit, track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Pill } from "./primitives"
import { useCatalog, useT } from "@/components/cms/provider"

export const PK_PHONE = /^(\+92|0092|0)?3\d{9}$/
export const normalisePhone = (p: string) => p.replace(/[\s-]/g, "")

/** "Notify me" / waitlist capture: phone + area (+ category). Feeds demand data per category x area. */
export function NotifyForm({
  category,
  area: fixedArea,
  source,
  compact,
  onDone,
  redirect,
}: {
  category?: string
  area?: string
  source: string
  compact?: boolean
  onDone?: () => void
  redirect?: boolean
}) {
  const { areas } = useCatalog()
  const t = useT()
  const router = useRouter()
  const loc = useLocation()
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [area, setArea] = useState(fixedArea ?? loc.area ?? "")
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [error, setError] = useState("")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!PK_PHONE.test(normalisePhone(phone))) return setError(t.notify.errPhone)
    if (!area) return setError(t.notify.errArea)
    setError("")
    setState("loading")
    try {
      await submit("waitlist", { phone: normalisePhone(phone), name, area, category: category ?? "any", source })
      track("notify_me", { category: category ?? "any", area, source })
      setState("done")
      onDone?.()
      if (redirect) router.push(`/waitlist/thanks?category=${category ?? ""}&area=${area}`)
    } catch (err) {
      setState("error")
      setError((err as Error).message)
    }
  }

  if (state === "done" && !redirect)
    return (
      <p className="flex items-center gap-2 text-sm text-brand-ink">
        <Check className="w-4 h-4" /> {t.notify.done}
      </p>
    )

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-2", !compact && "sm:flex-row sm:items-start")}>
      {!compact && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.notify.name} className="h-11 rounded-full border border-zinc-300 bg-white px-4 text-[16px] sm:text-sm outline-none focus:border-foreground" />
      )}
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder={t.notify.phone}
        aria-label={t.notify.phone}
        className="h-11 rounded-full border border-zinc-300 bg-white px-4 text-[16px] sm:text-sm outline-none focus:border-foreground"
      />
      {!fixedArea && (
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label={t.notify.area} className="h-11 rounded-full border border-zinc-300 bg-white px-4 text-[16px] sm:text-sm outline-none focus:border-foreground">
          <option value="">{t.notify.area}</option>
          {areas.map((a) => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </select>
      )}
      <Pill type="submit" variant="solid" disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t.common.notifyMe}
      </Pill>
      {error && <p className="text-xs text-destructive sm:basis-full">{error}</p>}
    </form>
  )
}
