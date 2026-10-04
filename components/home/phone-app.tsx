"use client"

// An interactive mini Mjazo app that lives inside the hero phone. It's real UI, not a
// picture: it browses the live catalogue, picks options, adds to the real cart, searches,
// and sets the visitor's area. Rendered at iPhone size (390×844) and
// scaled into the device frame, so everything stays crisp and inside the screen.

import Link from "@/components/site/locale-link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "@/components/site/locale-link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronLeft, ChevronRight, Clock, Home, Loader2, MapPin, Minus, Plus, Search, ShoppingBag, User } from "lucide-react"
import { formatDuration, formatPKR, proLabel, type Category, type Service } from "@/lib/catalog"
import { cartCount, cartTotal, useCart, useLocation } from "@/lib/store"
import { submit, track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/site/primitives"
import { useCatalog } from "@/components/cms/provider"

export const SCREEN_W = 390
export const SCREEN_H = 844

type Screen =
  | { name: "home" }
  | { name: "search" }
  | { name: "cart" }
  | { name: "profile" }
  | { name: "world"; slug: string }
  | { name: "category"; slug: string }
  | { name: "service"; cat: string; svc: string }

type Tab = "home" | "search" | "cart" | "profile"
type Nav = { push: (s: Screen) => void; back: () => void; tab: (t: Tab) => void; added: (name: string) => void }

const PK_PHONE = /^(\+92|0092|0)?3\d{9}$/

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
export function PhoneApp() {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }])
  const [toast, setToast] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const items = useCart((s) => s.items)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const current = stack[stack.length - 1]
  const nav: Nav = {
    push: (s) => setStack((st) => [...st, s]),
    back: () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)),
    tab: (t) => setStack([{ name: t }]),
    added: (name) => setToast(name),
  }
  const count = mounted ? cartCount(items) : 0

  return (
    <div className="relative w-[390px] h-[844px] bg-[#fbfaf7] text-[#111] font-sans overflow-clip">
      <StatusBar />
      <div className="absolute inset-x-0 top-[54px] bottom-[84px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={stack.length + current.name + JSON.stringify(current)}
            className="absolute inset-0 overflow-y-auto no-scrollbar overscroll-contain"
            data-lenis-prevent
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {current.name === "home" && <HomeScreen nav={nav} mounted={mounted} />}
            {current.name === "search" && <SearchScreen nav={nav} />}
            {current.name === "cart" && <CartScreen nav={nav} mounted={mounted} />}
            {current.name === "profile" && <ProfileScreen mounted={mounted} />}
            {current.name === "world" && <WorldScreen slug={current.slug} nav={nav} />}
            {current.name === "category" && <CategoryScreen slug={current.slug} nav={nav} />}
            {current.name === "service" && <ServiceScreen cat={current.cat} svc={current.svc} nav={nav} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => nav.tab("cart")}
            className="absolute bottom-[100px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-[#111] text-white pl-3 pr-4 h-10 text-[13px] shadow-xl whitespace-nowrap"
          >
            <Check className="w-4 h-4 text-[var(--brand)]" /> {toast} added · <span className="underline">View cart</span>
          </motion.button>
        )}
      </AnimatePresence>

      <TabBar active={stack[0].name as Tab} count={count} onTab={nav.tab} />
    </div>
  )
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 h-[54px] z-20 bg-[#fbfaf7]/90 backdrop-blur">
      <span className="absolute left-[34px] top-[17px] text-[15px] font-semibold tracking-tight">9:41</span>
      <div className="absolute left-1/2 top-[11px] -translate-x-1/2 w-[122px] h-[35px] rounded-full bg-black" />
      <div className="absolute right-[28px] top-[19px] flex items-center gap-[5px]">
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden><rect x="0" y="7" width="3" height="4" rx="1" fill="#111" /><rect x="4.5" y="5" width="3" height="6" rx="1" fill="#111" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="#111" /><rect x="13.5" y="0" width="3" height="11" rx="1" fill="#111" /></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden><path d="M7.5 2.2c2 0 3.9.8 5.3 2.1l1-1A8.9 8.9 0 0 0 7.5.8 8.9 8.9 0 0 0 1.2 3.3l1 1a7.5 7.5 0 0 1 5.3-2.1zm0 3c1.2 0 2.3.5 3.2 1.2l1-1a6 6 0 0 0-8.4 0l1 1c.9-.7 2-1.2 3.2-1.2zm0 3c-.5 0-.9.2-1.2.5l1.2 1.2 1.2-1.2c-.3-.3-.7-.5-1.2-.5z" fill="#111" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden><rect x=".5" y=".5" width="22" height="11" rx="3" stroke="#111" opacity=".4" fill="none" /><rect x="2" y="2" width="17" height="8" rx="1.8" fill="#111" /><rect x="23.5" y="4" width="1.6" height="4" rx=".8" fill="#111" opacity=".4" /></svg>
      </div>
    </div>
  )
}

function TabBar({ active, count, onTab }: { active: Tab; count: number; onTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "search", label: "Search", icon: Search },
    { id: "cart", label: "Cart", icon: ShoppingBag },
    { id: "profile", label: "Profile", icon: User },
  ]
  return (
    <div className="absolute inset-x-0 bottom-0 h-[84px] z-20 bg-white/95 backdrop-blur border-t border-black/5">
      <div className="grid grid-cols-4 pt-[8px]">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onTab(t.id)} className={cn("relative flex flex-col items-center gap-[3px] text-[10px]", active === t.id ? "text-[#111]" : "text-[#9a9a9a]")}>
            <t.icon className="w-[24px] h-[24px]" strokeWidth={active === t.id ? 2 : 1.6} />
            {t.label}
            {t.id === "cart" && count > 0 && <span className="absolute top-[-3px] left-1/2 ml-[6px] min-w-[17px] h-[17px] px-[4px] rounded-full bg-[var(--brand)] text-[10px] font-semibold text-[#111] flex items-center justify-center">{count}</span>}
          </button>
        ))}
      </div>
      <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[134px] h-[5px] rounded-full bg-[#111]" />
    </div>
  )
}

function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-[#fbfaf7]/95 backdrop-blur flex items-center gap-2 px-[16px] h-[52px]">
      {onBack && (
        <button onClick={onBack} aria-label="Back" className="w-[36px] h-[36px] -ml-[6px] rounded-full flex items-center justify-center hover:bg-black/5">
          <ChevronLeft className="w-[22px] h-[22px]" />
        </button>
      )}
      <p className="flex-1 text-[17px] font-semibold truncate">{title}</p>
      {right}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cart helpers
// ---------------------------------------------------------------------------
function useAdd(nav: Nav) {
  const add = useCart((s) => s.add)
  return (category: Category, service: Service, options: string[] = [], addOns: { id: string; name: string; price: number }[] = [], unitPrice = service.price) => {
    add(
      { category: category.slug, categoryName: category.name, service: service.slug, name: service.name, options, addOns, unitPrice, duration: service.duration },
      { open: false },
    )
    track("add_to_cart", { category: category.slug, service: service.slug, price: unitPrice, source: "hero_phone" })
    nav.added(service.name)
  }
}

function ServiceRow({ category, service, nav }: { category: Category; service: Service; nav: Nav }) {
  const add = useAdd(nav)
  const live = category.status === "live"
  const quick = live && service.price > 0 && !service.variants?.length
  return (
    <div className="flex items-start gap-3 py-[14px] border-b border-black/5">
      <button onClick={() => nav.push({ name: "service", cat: category.slug, svc: service.slug })} className="flex-1 text-left min-w-0">
        <p className="text-[15px] font-medium leading-snug">{service.name}</p>
        <p className="text-[12px] text-[#777] mt-[2px] line-clamp-2">{service.short}</p>
        <p className="text-[12px] mt-[6px] flex items-center gap-2">
          <span className="font-medium">{service.price > 0 ? formatPKR(service.price) : "On request"}</span>
          <span className="text-[#999] flex items-center gap-[3px]"><Clock className="w-[11px] h-[11px]" />{formatDuration(service.duration)}</span>
        </p>
      </button>
      {quick ? (
        <button onClick={() => add(category, service)} className="shrink-0 h-[34px] px-[12px] rounded-full border border-black/15 text-[13px] flex items-center gap-1 active:scale-95 transition-transform">
          <Plus className="w-[14px] h-[14px]" /> Add
        </button>
      ) : (
        <button onClick={() => nav.push({ name: "service", cat: category.slug, svc: service.slug })} className="shrink-0 h-[34px] px-[12px] rounded-full border border-black/15 text-[13px]">
          {live ? "Options" : "View"}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function HomeScreen({ nav, mounted }: { nav: Nav; mounted: boolean }) {
  const { allServices, getArea, getWorld, worlds, worldStatus } = useCatalog()
  const { area, subArea } = useLocation()
  const add = useAdd(nav)
  const popular = allServices.filter((x) => x.category.status === "live" && x.service.popular).slice(0, 8)
  const areaLabel = mounted && area ? `${getArea(area)?.name ?? ""}${subArea ? ` · ${subArea}` : ""}` : "Set your area"
  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-[20px] pt-[6px]">
        <p className="text-[22px] font-semibold tracking-tight">Mjazo</p>
        <button onClick={() => nav.tab("profile")} className="flex items-center gap-1 rounded-full bg-[#f1ece2] px-[12px] h-[32px] text-[12px] max-w-[190px]">
          <MapPin className="w-[13px] h-[13px] shrink-0" /> <span className="truncate">{areaLabel}</span>
        </button>
      </div>
      <h3 className="font-serif text-[40px] leading-[1.02] px-[20px] mt-[18px]">Ghar ka har kaam. Pakka.</h3>
      <p className="text-[14px] text-[#777] px-[20px] mt-[6px]">What do you need today?</p>
      <button onClick={() => nav.tab("search")} className="mx-[20px] mt-[16px] w-[350px] h-[48px] rounded-full bg-white border border-black/10 flex items-center gap-2 px-[16px] text-[14px] text-[#999] shadow-[0_6px_20px_-12px_rgba(0,0,0,0.3)]">
        <Search className="w-[17px] h-[17px]" /> Search waxing, facial, AC…
      </button>

      <div className="grid grid-cols-4 gap-x-[10px] gap-y-[14px] px-[20px] mt-[22px]">
        {worlds.map((w) => (
          <button key={w.slug} onClick={() => nav.push({ name: "world", slug: w.slug })} className="flex flex-col items-center gap-[6px] active:scale-95 transition-transform">
            <span className="relative w-[78px] h-[70px] rounded-[20px] flex items-center justify-center" style={{ background: w.tint }}>
              <Icon name={w.icon} className="w-[28px] h-[28px]" strokeWidth={1.4} />
              {worldStatus(w.slug) === "live" && <span className="absolute top-[7px] right-[7px] w-[8px] h-[8px] rounded-full bg-[var(--brand)] ring-2 ring-white" />}
            </span>
            <span className="text-[11px] leading-tight text-center h-[26px]">{w.name}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-[20px] mt-[24px] mb-[10px]">
        <p className="text-[17px] font-semibold">Most booked</p>
        <button onClick={() => nav.push({ name: "world", slug: "beauty-wellness" })} className="text-[13px] text-[#777]">See all</button>
      </div>
      <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-[20px] snap-x" data-lenis-prevent>
        {popular.map(({ category, service }) => (
          <div key={service.slug} className="snap-start shrink-0 w-[160px] rounded-[20px] bg-white border border-black/5 overflow-hidden">
            <button onClick={() => nav.push({ name: "service", cat: category.slug, svc: service.slug })} className="block w-full text-left">
              <span className="h-[86px] flex items-center justify-center" style={{ background: getWorld(category.world)?.tint }}>
                <Icon name={category.icon} className="w-[30px] h-[30px]" strokeWidth={1.2} />
              </span>
              <span className="block px-[12px] pt-[10px] text-[13px] font-medium leading-snug line-clamp-2 h-[44px]">{service.name}</span>
            </button>
            <div className="flex items-center justify-between px-[12px] pb-[12px] pt-[4px]">
              <span className="text-[12px] font-medium">{formatPKR(service.price)}</span>
              <button
                aria-label={`Add ${service.name}`}
                onClick={() => (service.variants?.length ? nav.push({ name: "service", cat: category.slug, svc: service.slug }) : add(category, service))}
                className="w-[30px] h-[30px] rounded-full bg-[#111] text-white flex items-center justify-center active:scale-90 transition-transform"
              >
                <Plus className="w-[15px] h-[15px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => nav.push({ name: "category", slug: "womens-salon" })} className="relative mx-[20px] mt-[20px] w-[350px] rounded-[24px] bg-[#111] text-white p-[20px] text-left overflow-hidden">
        <span className="absolute -right-10 -top-10 w-[160px] h-[160px] rounded-full bg-[var(--brand)] opacity-30 blur-2xl" />
        <span className="relative inline-block rounded-full bg-[var(--brand)] text-[#111] text-[11px] px-[10px] py-[3px]">Hero bundle</span>
        <span className="relative block font-serif text-[26px] mt-[10px]">The Full Glow</span>
        <span className="relative block text-[13px] text-white/70 mt-[2px]">Full body wax + brightening facial</span>
        <span className="relative inline-flex items-center gap-1 mt-[14px] text-[13px]">Explore <ChevronRight className="w-[14px] h-[14px]" /></span>
      </button>
    </div>
  )
}

function WorldScreen({ slug, nav }: { slug: string; nav: Nav }) {
  const { categoriesOf, getWorld, worldStatus } = useCatalog()
  const world = getWorld(slug)
  if (!world) return null
  const live = worldStatus(slug) === "live"
  return (
    <div className="pb-6">
      <Header title={world.name} onBack={nav.back} />
      <div className="mx-[16px] rounded-[24px] p-[18px] flex items-center gap-[14px]" style={{ background: world.tint }}>
        <span className="w-[54px] h-[54px] rounded-[16px] bg-white/60 flex items-center justify-center"><Icon name={world.icon} className="w-[28px] h-[28px]" strokeWidth={1.4} /></span>
        <div>
          <p className="text-[15px] font-medium">{world.short}</p>
          <p className="text-[12px] text-black/60 mt-[2px]">Available across Karachi</p>
        </div>
      </div>
      <div className="px-[16px] mt-[10px]">
        {categoriesOf(slug).map((c) => (
          <button key={c.slug} onClick={() => nav.push({ name: "category", slug: c.slug })} className="w-full flex items-center gap-[12px] py-[14px] border-b border-black/5 text-left">
            <span className="w-[44px] h-[44px] rounded-[14px] bg-white border border-black/5 flex items-center justify-center"><Icon name={c.icon} className="w-[22px] h-[22px]" strokeWidth={1.4} /></span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 text-[15px] font-medium">{c.name}{c.status !== "live" && <span className="text-[10px] font-normal rounded-full bg-black/5 px-[7px] py-[1px] text-[#777]">Soon</span>}</span>
              <span className="block text-[12px] text-[#777] truncate">{c.tagline}</span>
            </span>
            <ChevronRight className="w-[18px] h-[18px] text-[#bbb]" />
          </button>
        ))}
      </div>
    </div>
  )
}

function NotifyInline({ category }: { category: Category }) {
  const { area } = useLocation()
  const [phone, setPhone] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const [error, setError] = useState("")
  const go = async () => {
    const p = phone.replace(/[\s-]/g, "")
    if (!PK_PHONE.test(p)) return setError("Enter a mobile number like 0300 1234567")
    setError("")
    setState("loading")
    try {
      await submit("waitlist", { phone: p, area: area ?? "unknown", category: category.slug, source: "hero_phone" })
      track("notify_me", { category: category.slug, area: area ?? "unknown", source: "hero_phone" })
      setState("done")
    } catch (e) {
      setState("idle")
      setError((e as Error).message)
    }
  }
  if (state === "done") return <p className="flex items-center gap-2 text-[13px] text-[var(--brand-ink)]"><Check className="w-4 h-4" /> You're on the list. We'll WhatsApp you.</p>
  return (
    <div>
      <div className="flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp number" aria-label="WhatsApp number" className="flex-1 min-w-0 h-[42px] rounded-full border border-black/15 bg-white px-[14px] text-[16px] outline-none focus:border-black" />
        <button onClick={go} disabled={state === "loading"} className="h-[42px] px-[16px] rounded-full bg-[#111] text-white text-[13px] flex items-center">
          {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Notify me"}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 mt-[6px]">{error}</p>}
    </div>
  )
}

function CategoryScreen({ slug, nav }: { slug: string; nav: Nav }) {
  const { MIN_ORDER, areas, getArea, getCategory, getService, getWorld, searchServices } = useCatalog()
  const category = getCategory(slug)
  if (!category) return null
  const live = category.status === "live"
  return (
    <div className="pb-6">
      <Header title={category.name} onBack={nav.back} />
      <div className="px-[16px]">
        <p className="font-serif text-[28px] leading-tight">{category.heroLine}</p>
        <div className="flex flex-wrap gap-[6px] mt-[10px]">
          <span className="rounded-full bg-black/5 px-[10px] py-[4px] text-[11px]">{proLabel[category.proType]}</span>
          {live ? (
            <span className="rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)] px-[10px] py-[4px] text-[11px]">Available across Karachi</span>
          ) : (
            <span className="rounded-full bg-black/5 text-[#777] px-[10px] py-[4px] text-[11px]">Coming soon</span>
          )}
        </div>
        {!live && (
          <div className="mt-[14px] rounded-[20px] bg-white border border-black/5 p-[14px]">
            <p className="text-[13px] mb-[10px]">Want {category.name.toLowerCase()} in your area? Join the waitlist: we open where it's loudest.</p>
            <NotifyInline category={category} />
          </div>
        )}
        <div className="mt-[6px]">
          {category.services.map((s) => (
            <ServiceRow key={s.slug} category={category} service={s} nav={nav} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ServiceScreen({ cat, svc, nav }: { cat: string; svc: string; nav: Nav }) {
  const { getService, getWorld } = useCatalog()
  const found = getService(cat, svc)
  const add = useAdd(nav)
  const [picks, setPicks] = useState<number[]>(() => found?.service.variants?.map(() => 0) ?? [])
  const [addOns, setAddOns] = useState<string[]>([])
  if (!found) return null
  const { category, service } = found
  const world = getWorld(category.world)
  const live = category.status === "live"
  const variantDelta = service.variants?.reduce((sum, v, i) => sum + v.options[picks[i] ?? 0].delta, 0) ?? 0
  const chosenAddOns = service.addOns?.filter((a) => addOns.includes(a.id)) ?? []
  const price = service.price + variantDelta + chosenAddOns.reduce((s, a) => s + a.price, 0)

  return (
    <div>
      <Header title="" onBack={nav.back} />
      <div className="mx-[16px] h-[150px] rounded-[24px] flex items-center justify-center" style={{ background: world?.tint }}>
        <Icon name={category.icon} className="w-[56px] h-[56px]" strokeWidth={1} />
      </div>
      <div className="px-[16px] mt-[16px]">
        <p className="text-[12px] text-[#777]">{category.name}</p>
        <p className="text-[22px] font-semibold leading-tight mt-[2px]">{service.name}</p>
        <p className="text-[14px] text-[#666] mt-[6px]">{service.short}</p>
        <p className="text-[13px] mt-[10px] flex items-center gap-3">
          <span className="font-medium">{service.price > 0 ? formatPKR(price) : "Price on request"}</span>
          <span className="text-[#999] flex items-center gap-1"><Clock className="w-[12px] h-[12px]" />{formatDuration(service.duration)}</span>
        </p>

        {service.variants?.map((v, vi) => (
          <div key={v.label} className="mt-[18px]">
            <p className="text-[13px] font-medium mb-[8px]">{v.label}</p>
            <div className="flex flex-wrap gap-[8px]">
              {v.options.map((o, oi) => (
                <button
                  key={o.label}
                  onClick={() => setPicks((p) => p.map((x, i) => (i === vi ? oi : x)))}
                  className={cn("rounded-full border px-[12px] h-[34px] text-[13px] transition-colors", picks[vi] === oi ? "bg-[#111] text-white border-[#111]" : "border-black/15")}
                >
                  {o.label}{o.delta ? ` ${o.delta > 0 ? "+" : "−"}${Math.abs(o.delta).toLocaleString("en-PK")}` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}

        {service.addOns?.length ? (
          <div className="mt-[18px]">
            <p className="text-[13px] font-medium mb-[8px]">Add-ons</p>
            {service.addOns.map((a) => {
              const on = addOns.includes(a.id)
              return (
                <button key={a.id} onClick={() => setAddOns((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))} className="w-full flex items-center justify-between py-[10px] border-b border-black/5 text-[14px]">
                  <span className="flex items-center gap-2">
                    <span className={cn("w-[20px] h-[20px] rounded-[6px] border flex items-center justify-center", on ? "bg-[#111] border-[#111] text-white" : "border-black/25")}>{on && <Check className="w-[13px] h-[13px]" />}</span>
                    {a.name}
                  </span>
                  <span className="text-[#777]">+{formatPKR(a.price)}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="mt-[18px] rounded-[18px] bg-white border border-black/5 p-[14px]">
          <p className="text-[13px] font-medium mb-[6px]">Every visit includes</p>
          {category.includes.slice(0, 4).map((x) => (
            <p key={x} className="text-[12px] text-[#666] flex gap-2 py-[2px]"><Check className="w-[13px] h-[13px] mt-[2px] shrink-0 text-[var(--brand-ink)]" />{x}</p>
          ))}
        </div>

        {!live && (
          <div className="mt-[14px] rounded-[18px] bg-white border border-black/5 p-[14px]">
            <p className="text-[13px] mb-[10px]">Coming soon. Get a WhatsApp the day it opens in your area.</p>
            <NotifyInline category={category} />
          </div>
        )}
      </div>

      {live && service.price > 0 && (
        <div className="sticky bottom-0 z-10 px-[16px] pb-[12px] pt-[18px] mt-[10px] bg-gradient-to-t from-[#fbfaf7] via-[#fbfaf7] to-transparent">
          <button
            onClick={() => add(category, service, service.variants?.map((v, i) => v.options[picks[i] ?? 0].label) ?? [], chosenAddOns, price)}
            className="w-full h-[50px] rounded-full bg-[#111] text-white text-[15px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            Add to cart · {formatPKR(price)}
          </button>
        </div>
      )}
    </div>
  )
}

function SearchScreen({ nav }: { nav: Nav }) {
  const { searchServices } = useCatalog()
  const [q, setQ] = useState("")
  const results = useMemo(() => searchServices(q).slice(0, 12), [q])
  return (
    <div className="pb-6">
      <div className="sticky top-0 z-10 bg-[#fbfaf7]/95 backdrop-blur px-[16px] pt-[6px] pb-[10px]">
        <p className="text-[28px] font-semibold tracking-tight mb-[10px]">Search</p>
        <div className="h-[46px] rounded-full bg-white border border-black/10 flex items-center gap-2 px-[14px]">
          <Search className="w-[17px] h-[17px] text-[#999]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Waxing, facial, AC service…" aria-label="Search services" className="flex-1 bg-transparent outline-none text-[16px]" />
        </div>
      </div>
      <div className="px-[16px]">
        {!q && (
          <div className="flex flex-wrap gap-[8px] mt-[6px]">
            {["Waxing", "Facial", "Mehndi", "Massage", "Keratin", "AC service", "Deep cleaning"].map((s) => (
              <button key={s} onClick={() => setQ(s)} className="rounded-full border border-black/10 bg-white px-[12px] h-[34px] text-[13px]">{s}</button>
            ))}
          </div>
        )}
        {q && results.length === 0 && <p className="text-[14px] text-[#777] mt-[20px] text-center">No match for “{q}”.</p>}
        {results.map((r) => {
          const [, , cat, svc] = r.href.split("/")
          return (
            <button key={r.href} onClick={() => nav.push({ name: "service", cat, svc })} className="w-full flex items-center justify-between py-[12px] border-b border-black/5 text-left">
              <span>
                <span className="block text-[15px]">{r.title}</span>
                <span className="block text-[12px] text-[#777]">{r.subtitle}</span>
              </span>
              {r.status === "live" ? <span className="text-[11px] rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)] px-[8px] py-[2px]">Live</span> : <span className="text-[11px] rounded-full bg-black/5 text-[#777] px-[8px] py-[2px]">Soon</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CartScreen({ nav, mounted }: { nav: Nav; mounted: boolean }) {
  const { MIN_ORDER } = useCatalog()
  const router = useRouter()
  const { items, setQty } = useCart()
  const list = mounted ? items : []
  const total = cartTotal(list)
  return (
    <div className="min-h-full flex flex-col">
      <div className="px-[16px] pt-[6px]"><p className="text-[28px] font-semibold tracking-tight">Cart</p></div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center text-center mt-[80px] px-[30px]">
          <ShoppingBag className="w-[44px] h-[44px] text-[#ccc]" strokeWidth={1} />
          <p className="text-[15px] mt-[12px]">Your cart is empty</p>
          <p className="text-[13px] text-[#777] mt-[4px]">Add a service and it shows up here, and on the real site too.</p>
          <button onClick={() => nav.push({ name: "world", slug: "beauty-wellness" })} className="mt-[18px] h-[42px] px-[18px] rounded-full bg-[#111] text-white text-[14px]">Browse beauty</button>
        </div>
      ) : (
        <div className="px-[16px]">
          {list.map((i) => (
            <div key={i.key} className="flex gap-3 py-[12px] border-b border-black/5">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium">{i.name}</p>
                {(i.options.length > 0 || i.addOns.length > 0) && <p className="text-[11px] text-[#888] mt-[2px] truncate">{[...i.options, ...i.addOns.map((a) => `+ ${a.name}`)].join(" · ")}</p>}
                <div className="flex items-center mt-[8px] rounded-full border border-black/10 w-fit">
                  <button aria-label="Decrease" onClick={() => setQty(i.key, i.qty - 1)} className="w-[30px] h-[28px] flex items-center justify-center"><Minus className="w-[13px] h-[13px]" /></button>
                  <span className="text-[13px] w-[18px] text-center">{i.qty}</span>
                  <button aria-label="Increase" onClick={() => setQty(i.key, i.qty + 1)} className="w-[30px] h-[28px] flex items-center justify-center"><Plus className="w-[13px] h-[13px]" /></button>
                </div>
              </div>
              <p className="text-[14px] font-medium">{formatPKR(i.unitPrice * i.qty)}</p>
            </div>
          ))}
          <div className="mt-[14px]">
            {total < MIN_ORDER ? (
              <>
                <p className="text-[12px] text-[#777] mb-[6px]">Add {formatPKR(MIN_ORDER - total)} more to reach the {formatPKR(MIN_ORDER)} minimum.</p>
                <div className="h-[6px] rounded-full bg-black/5 overflow-hidden"><div className="h-full bg-[var(--brand)]" style={{ width: `${Math.min(100, (total / MIN_ORDER) * 100)}%` }} /></div>
              </>
            ) : (
              <p className="text-[12px] text-[var(--brand-ink)]">Minimum order reached.</p>
            )}
          </div>
        </div>
      )}
      {list.length > 0 && (
        <div className="sticky bottom-0 z-10 px-[16px] pb-[12px] pt-[18px] mt-auto bg-gradient-to-t from-[#fbfaf7] via-[#fbfaf7] to-transparent">
          <div className="flex justify-between text-[15px] mb-[8px]"><span>Total</span><span className="font-semibold">{formatPKR(total)}</span></div>
          <button
            disabled={total < MIN_ORDER}
            onClick={() => router.push("/checkout")}
            className="w-full h-[50px] rounded-full bg-[#111] text-white text-[15px] font-medium disabled:opacity-40"
          >
            Checkout · pay after service
          </button>
        </div>
      )}
    </div>
  )
}

function ProfileScreen({ mounted }: { mounted: boolean }) {
  const { areas, getArea } = useCatalog()
  const loc = useLocation()
  const current = mounted ? loc.area : null
  const area = current ? getArea(current) : undefined
  return (
    <div className="pb-6 px-[16px]">
      <p className="text-[28px] font-semibold tracking-tight pt-[6px]">Profile</p>
      <div className="mt-[14px] rounded-[20px] bg-white border border-black/5 p-[16px]">
        <p className="text-[15px] font-medium">Where should we come?</p>
        <p className="text-[12px] text-[#777] mt-[2px]">We come to 8 neighbourhoods across Karachi.</p>
        <div className="grid grid-cols-2 gap-[8px] mt-[12px]">
          {areas.map((a) => (
            <button
              key={a.slug}
              onClick={() => {
                loc.set(a.slug, null)
                track("set_location", { area: a.slug, source: "hero_phone" })
              }}
              className={cn("rounded-[14px] border px-[12px] py-[10px] text-left text-[13px]", current === a.slug ? "border-[#111] bg-[#111] text-white" : "border-black/10")}
            >
              <span className="flex items-center justify-between">
                {a.name}
                {a.status === "live" ? <span className="w-[7px] h-[7px] rounded-full bg-[var(--brand)]" /> : <span className={cn("text-[10px]", current === a.slug ? "text-white/60" : "text-[#999]")}>soon</span>}
              </span>
            </button>
          ))}
        </div>
        {area?.status === "live" && (
          <div className="flex flex-wrap gap-[6px] mt-[12px]">
            {area.subAreas.map((s) => (
              <button key={s} onClick={() => loc.set(area.slug, s)} className={cn("rounded-full border px-[10px] h-[30px] text-[12px]", mounted && loc.subArea === s ? "bg-[var(--brand)] border-[var(--brand)]" : "border-black/10")}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-[14px] rounded-[20px] bg-white border border-black/5 divide-y divide-black/5">
        {[
          ["Your bookings", "/account/bookings"],
          ["Saved details", "/account/addresses"],
          ["Mjazo Plus", "/plus"],
          ["Refer & earn", "/refer"],
          ["Help & support", "/help"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="flex items-center justify-between px-[16px] h-[50px] text-[14px] hover:bg-black/[0.02]">
            {label}
            <ChevronRight className="w-[16px] h-[16px] text-[#bbb]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
