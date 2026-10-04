"use client"

import { motion } from "framer-motion"
import { ShieldCheck } from "lucide-react"
import { useCatalog, useT } from "@/components/cms/provider"
import { ServiceCard } from "@/components/site/service-card"
import { EnquiryForm } from "@/components/site/forms"
import { cn } from "@/lib/utils"

// The interactive parts of block pages (components/cms/blocks.tsx): they need the catalogue,
// the cart or the browser.

/** Two rows of promises drifting in opposite directions (as on the home page). */
export function PromiseRows({ items, dark }: { items: string[]; dark?: boolean }) {
  const half = Math.ceil(items.length / 2)
  const rows = [items.slice(0, half), items.slice(half)].filter((r) => r.length)
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} dir="ltr" className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          <motion.div className="flex shrink-0 gap-3 pe-3" animate={{ x: i % 2 ? ["-50%", "0%"] : ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
            {[...r, ...r, ...r].map((t, j) => (
              <span key={j} className={cn("flex items-center gap-2 whitespace-nowrap rounded-full border px-5 py-3 text-sm", dark ? "border-white/15 bg-white/5" : "border-zinc-200 bg-white")}>
                <ShieldCheck className={cn("h-4 w-4", dark ? "text-brand" : "text-brand-ink")} strokeWidth={1.5} />
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  )
}

/** Bookable service cards: picked by hand, a whole category, or the most booked. */
export function ServiceGrid({ source, limit, category, services, emptyNote }: { source: string; limit: number; category?: string; services: string[]; emptyNote?: string }) {
  const { allServices } = useCatalog()
  const n = Math.max(1, Math.min(12, limit || 4))
  const items =
    source === "pick"
      ? services.map((slug) => allServices.find((x) => x.service.slug === slug)).filter((x): x is (typeof allServices)[number] => Boolean(x))
      : source === "category"
        ? allServices.filter((x) => x.category.slug === category).slice(0, n)
        : allServices.filter((x) => x.category.status === "live" && x.service.popular).slice(0, n)
  if (!items.length) return emptyNote ? <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{emptyNote}</p> : null
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ category: c, service }) => (
        <ServiceCard key={`${c.slug}/${service.slug}`} category={c} service={service} />
      ))}
    </div>
  )
}

/** The enquiry form, sent with the page it came from. */
export function PageForm({ path, title, askDate, askArea, whatsapp, submitLabel, success, dark }: { path: string; title: string; askDate?: boolean; askArea?: boolean; whatsapp?: boolean; submitLabel?: string; success?: string; dark?: boolean }) {
  const t = useT()
  const { areas } = useCatalog()
  const extras = [
    ...(askArea ? [{ name: "area", label: t.form.area, type: "select" as const, options: areas.filter((a) => a.status === "live").map((a) => a.name) }] : []),
    ...(askDate ? [{ name: "date", label: t.form.date, type: "date" as const }] : []),
  ]
  return (
    <EnquiryForm
      kind="page"
      extras={extras}
      submitLabel={submitLabel || undefined}
      whatsappText={whatsapp ? `Hi Mjazo, I'm asking about ${title || path}.` : undefined}
      success={success || undefined}
      dark={dark}
      context={{ page: path, form: title }}
    />
  )
}
