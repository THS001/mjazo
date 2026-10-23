"use client"

import Link, { useRouter } from "@/components/site/locale-link"
import { useEffect, useState, type ReactNode } from "react"
import { CalendarCheck, Check, Loader2, Repeat } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { isPackLine } from "@/lib/packs"
import { customerApi, useAccount } from "@/lib/client/customer"
import { formatBookingDate, karachiNow } from "@/lib/bookings"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { CustomerPackView } from "@/lib/server/customer-api"
import type { PackOfferView } from "@/lib/server/pack-offers"
import { fill, useCatalog, useLocale, useT } from "@/components/cms/provider"
import { AccountShell } from "./account-views"
import { PhoneLink, SignInPrompt } from "./customer-views"

// Packs on the website (lib/packs.ts): the packs on offer, theirs with "Book your next visit", and
// asking for one. Through /api/v1/customer/packs, like the phone app. Ops take the money and
// activate a pack in mission control; then checkout uses it (?pack=).

type Data = { offers: PackOfferView[]; mine: CustomerPackView[] }
const card = "rounded-3xl bg-white border border-zinc-200"

/** One pack on offer: what each visit is, the price a visit against the usual price, and the saving. */
export function PackCard({ o, dark, action }: { o: PackOfferView; dark?: boolean; action?: ReactNode }) {
  const t = useT().packs
  return (
    <article id={o.slug} className={cn("scroll-mt-28 rounded-[2rem] p-7 sm:p-8 h-full flex flex-col", dark ? "border border-white/10 bg-white/[0.03]" : card)}>
      <Repeat className={cn("w-6 h-6", dark ? "text-brand" : "text-brand-ink")} strokeWidth={1.5} />
      <h3 className="font-serif text-3xl sm:text-4xl mt-4">{o.name}</h3>
      <p className={cn("text-sm mt-1", dark ? "text-white/50" : "text-zinc-500")}>{fill(t.visitsEvery, { visits: o.visits, days: o.everyDays })}</p>
      <p className={cn("mt-4 flex-1", dark ? "text-white/65" : "text-zinc-600")}>{o.note || o.itemName}</p>
      <div className="mt-6">
        <p className={cn("font-serif text-3xl", dark ? "text-brand" : "")}>{fill(t.aVisit, { price: formatPKR(o.visitPrice) })}</p>
        {o.listPrice > o.visitPrice && <p className={cn("text-sm line-through", dark ? "text-white/40" : "text-zinc-400")}>{fill(t.insteadOf, { price: formatPKR(o.listPrice) })}</p>}
        <p className={cn("text-sm mt-2", dark ? "text-white/60" : "text-zinc-600")}>{fill(t.upfront, { total: formatPKR(o.total), saving: formatPKR(o.saving) })}</p>
        <p className={cn("text-xs mt-1", dark ? "text-white/40" : "text-zinc-500")}>{fill(t.useWithin, { days: o.validDays })}</p>
      </div>
      {action && <div className="mt-6">{action}</div>}
    </article>
  )
}

/** /account/packs: theirs and the packs on offer (signed out: the offers and a sign-in prompt). */
export function PacksPage({ offers }: { offers: PackOfferView[] }) {
  const t = useT().packs
  const acc = useAccount()
  if (acc.state === "loading") return <AccountShell title={t.title} sub={null}><div className={cn(card, "h-40 animate-pulse")} /></AccountShell>
  if (acc.state === "phone") return <AccountShell title={t.title} sub={null}><PhoneLink me={acc.me} /></AccountShell>
  if (acc.state === "in") return <AccountShell title={t.title} sub={t.intro}><LivePacks fallback={offers} /></AccountShell>
  return (
    <AccountShell title={t.title} sub={t.intro}>
      <SignInPrompt className="mb-6" />
      <OfferGrid offers={offers} action={() => <Link href="/login?next=/account/packs" className="inline-flex h-12 px-6 items-center rounded-full bg-foreground text-background text-sm">{t.signIn}</Link>} />
    </AccountShell>
  )
}

function OfferGrid({ offers, action }: { offers: PackOfferView[]; action: (o: PackOfferView) => ReactNode }) {
  const t = useT().packs
  if (!offers.length) return <p className="text-zinc-500">{t.noneOnOffer}</p>
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {offers.map((o) => (
        <PackCard key={o.slug} o={o} action={action(o)} />
      ))}
    </div>
  )
}

function LivePacks({ fallback }: { fallback: PackOfferView[] }) {
  const t = useT().packs
  const locale = useLocale()
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [asked, setAsked] = useState("")
  useEffect(() => {
    customerApi<Data>(`/api/v1/customer/packs?lang=${locale}`).then(setData, (e) => setError((e as Error).message))
  }, [locale])
  const ask = async (o: PackOfferView) => {
    setBusy(o.slug)
    setError("")
    try {
      setData(await customerApi<Data>(`/api/v1/customer/packs?lang=${locale}`, { slug: o.slug }))
      setAsked(o.slug)
      track("pack_request", { pack: o.slug, total: o.total })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const offers = data?.offers ?? fallback
  const mine = data?.mine ?? []
  const waiting = new Set(mine.filter((k) => k.status === "requested").map((k) => k.slug))
  return (
    <div className="space-y-10">
      {error && <p className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}
      {mine.length > 0 && (
        <section>
          <h2 className="font-serif text-3xl mb-4">{t.yours}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {mine.map((k) => (
              <MyPack key={k.id} k={k} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="font-serif text-3xl mb-4">{t.onOffer}</h2>
        <OfferGrid
          offers={offers}
          action={(o) =>
            waiting.has(o.slug) ? (
              <p className="rounded-2xl bg-brand-soft text-brand-ink px-4 py-3 text-sm flex gap-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                {asked === o.slug ? fill(t.asked, { total: formatPKR(o.total) }) : fill(t.waiting, { total: formatPKR(o.total) })}
              </p>
            ) : (
              <button onClick={() => ask(o)} disabled={Boolean(busy)} className="h-12 px-6 rounded-full bg-foreground text-background text-sm flex items-center gap-2 disabled:opacity-60">
                {busy === o.slug && <Loader2 className="w-4 h-4 animate-spin" />} {t.get}
              </button>
            )
          }
        />
      </section>
    </div>
  )
}

/** One of their packs: how many visits are left, by when, and booking the next one. */
function MyPack({ k }: { k: CustomerPackView }) {
  const t = useT().packs
  const offersT = useT().offers
  const locale = useLocale()
  const router = useRouter()
  const { getCategory } = useCatalog()
  const { items, add } = useCart()
  // A day, or a moment's day in Karachi.
  const day = (iso: string) => formatBookingDate(iso.length > 10 ? karachiNow(new Date(iso)).date : iso, locale)
  const canBook = k.status === "active" && !k.expired && k.left > 0 && k.line
  const book = () => {
    const l = k.line!
    // One visit in the cart (unless it's there already), then checkout with the pack.
    if (!items.some((i) => isPackLine(i, l)))
      add({ category: l.category, categoryName: l.service.startsWith("bundle-") ? offersT.bundle : getCategory(l.category)?.name ?? "", service: l.service, name: l.name, options: l.options, addOns: [], unitPrice: l.unitPrice, duration: l.duration }, { open: false })
    track("pack_book", { pack: k.slug })
    router.push(`/checkout?pack=${encodeURIComponent(k.id)}`)
  }
  const status =
    k.status === "requested" ? fill(t.waiting, { total: formatPKR(k.total) }) : k.expired ? t.ended : k.left === 0 && k.booked === 0 ? t.allUsed : [fill(t.left, { left: k.left, visits: k.visits }), k.booked ? fill(t.booked, { count: k.booked }) : ""].filter(Boolean).join(" · ")
  return (
    <article className={cn(card, "p-6 flex flex-col gap-3")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-2xl">{k.name}</p>
          <p className="text-sm text-zinc-500">{k.itemName}</p>
        </div>
        <Repeat className="w-5 h-5 text-brand-ink shrink-0" />
      </div>
      <p className="font-medium">{status}</p>
      {k.status === "active" && !k.expired && k.endsAt && <p className="text-sm text-zinc-500">{fill(t.until, { date: day(k.endsAt) })}</p>}
      {k.nextDue && canBook && (
        <p className="text-sm text-zinc-600 flex items-center gap-1.5">
          <CalendarCheck className="w-4 h-4" />
          {fill(t.nextDue, { date: day(k.nextDue) })}
        </p>
      )}
      {canBook && (
        <button onClick={book} className="mt-2 h-12 px-6 self-start rounded-full bg-foreground text-background text-sm">
          {t.bookNext}
        </button>
      )}
    </article>
  )
}
