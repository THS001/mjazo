"use client"

import Link from "@/components/site/locale-link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, MapPin, Menu, Search, ShoppingBag, User, X } from "lucide-react"
import { cartCount, useCart, useLocation } from "@/lib/store"
import { cn } from "@/lib/utils"
import { EASE, Icon, Pill } from "./primitives"
import { LocationDialog } from "./location-dialog"
import { SearchDialog } from "./search-dialog"
import NextLink from "next/link"
import { localePath } from "@/lib/i18n"
import { useCatalog, useLocale, useNav, useSite, useT } from "@/components/cms/provider"
import { stripLocale } from "@/lib/i18n"

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 py-1.5 -my-1.5", className)} aria-label="Mjazo home">
      <svg viewBox="0 0 24 24" className={cn("w-6 h-6", light ? "text-white" : "text-foreground")} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M8 21v-6.5l4 3.5 4-3.5V21" />
        <circle cx="18.5" cy="5.5" r="1.6" fill="var(--brand)" stroke="none" />
      </svg>
      <span className={cn("text-lg font-medium tracking-tight", light ? "text-white" : "text-foreground")}>Mjazo</span>
    </Link>
  )
}

export function Header() {
  const { categoriesOf, getArea, worlds, worldStatus } = useCatalog()
  const { header: nav } = useNav()
  const t = useT()
  const locale = useLocale()
  const { flags } = useSite()
  const showLang = flags.URDU_SITE || locale === "ur"
  // Plain next/link: the switch must not be kept in the current locale like other links.
  const langHref = (p: string) => (locale === "en" ? localePath(p, "ur") : p)
  const pathname = stripLocale(usePathname())
  const [menu, setMenu] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [locOpen, setLocOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const items = useCart((s) => s.items)
  const setCartOpen = useCart((s) => s.setOpen)
  const { area, subArea } = useLocation()
  const count = mounted ? cartCount(items) : 0
  const areaName = mounted && area ? `${getArea(area)?.name ?? ""}${subArea ? ` · ${subArea}` : ""}` : nav.selectArea

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    setMenu(false)
    setMobile(false)
  }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    const openSearch = () => setSearchOpen(true)
    const openLoc = () => setLocOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("mjazo:search", openSearch)
    window.addEventListener("mjazo:location", openLoc)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mjazo:search", openSearch)
      window.removeEventListener("mjazo:location", openLoc)
    }
  }, [])

  return (
    <>
      <header className="fixed top-0 start-0 end-0 z-50 px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]" onMouseLeave={() => setMenu(false)}>
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto rounded-2xl bg-white/75 backdrop-blur-xl border border-zinc-200 px-4 sm:px-6 py-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Logo />
              <button
                onClick={() => setLocOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:border-zinc-400 transition-colors max-w-[200px] lg:max-w-[150px] xl:max-w-[200px]"
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{areaName}</span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>
            </div>

            <nav className="hidden lg:flex items-center gap-5 xl:gap-7 whitespace-nowrap">
              <button
                onMouseEnter={() => setMenu(true)}
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-1 text-sm text-zinc-600 hover:text-black transition-colors whitespace-nowrap"
                aria-expanded={menu}
              >
                {nav.services} <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", menu && "rotate-180")} />
              </button>
              {nav.links.map((n) => (
                <Link key={n.href} href={n.href} onMouseEnter={() => setMenu(false)} className={cn("text-sm transition-colors", pathname.startsWith(n.href) ? "text-black" : "text-zinc-600 hover:text-black")}>
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              {showLang && (
                <NextLink href={langHref(pathname)} hrefLang={locale === "en" ? "ur" : "en"} lang={locale === "en" ? "ur" : "en"} className={cn("hidden sm:flex h-10 items-center rounded-full px-3 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-black", locale === "en" && "font-urdu")}>
                  {t.common.language}
                </NextLink>
              )}
              <button onClick={() => setSearchOpen(true)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors" aria-label="Search services">
                <Search className="w-4 h-4" />
              </button>
              <button onClick={() => setCartOpen(true)} className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors" aria-label={`Cart, ${count} items`}>
                <ShoppingBag className="w-4 h-4" />
                {count > 0 && <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-brand text-[10px] font-semibold flex items-center justify-center">{count}</span>}
              </button>
              <Link href="/login" className="hidden lg:flex xl:hidden w-10 h-10 rounded-full items-center justify-center hover:bg-zinc-100 transition-colors" aria-label={nav.login}><User className="w-4 h-4" /></Link>
              <Link href="/login" className="hidden md:block lg:hidden xl:block text-sm text-zinc-600 hover:text-black px-3 whitespace-nowrap">{nav.login}</Link>
              <Pill href={nav.book.href} className="hidden md:inline-flex">{nav.book.label}</Pill>
              <button className="lg:hidden w-10 h-10 flex items-center justify-center" onClick={() => setMobile((m) => !m)} aria-label="Menu" aria-expanded={mobile}>
                {mobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mega menu: 8 worlds x categories */}
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="hidden lg:block overflow-hidden"
              >
                <div className="grid grid-cols-4 gap-x-6 gap-y-6 border-t border-zinc-200 mt-3 pt-6 pb-4">
                  {worlds.map((w, i) => (
                    <motion.div key={w.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.3 }}>
                      <Link href={`/services/w/${w.slug}`} className="flex items-center gap-2 mb-2 group">
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: w.tint }}>
                          <Icon name={w.icon} className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-medium group-hover:underline underline-offset-4">{w.name}</span>
                        {worldStatus(w.slug) === "live" && <span className="live-dot w-1.5 h-1.5 rounded-full bg-brand" />}
                      </Link>
                      <ul className="space-y-1 ps-10">
                        {categoriesOf(w.slug).map((c) => (
                          <li key={c.slug}>
                            <Link href={`/services/${c.slug}`} className="text-[13px] text-zinc-500 hover:text-black transition-colors">
                              {c.name}
                              {c.status !== "live" && <span className="ms-1.5 text-[10px] text-zinc-400">{nav.soon}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t border-zinc-200 pt-3 pb-1 text-xs text-zinc-500">
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-brand me-1.5 align-middle" />{nav.megaNote}</span>
                  <Link href="/services" className="text-black underline underline-offset-4">{nav.allServices}</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobile && (
              <motion.nav initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="lg:hidden overflow-hidden">
                <div className="border-t border-zinc-200 mt-3 pt-4 pb-2 flex flex-col gap-1 max-h-[70svh] overflow-y-auto" data-lenis-prevent>
                  <button onClick={() => setLocOpen(true)} className="sm:hidden flex items-center gap-2 py-2 text-sm text-zinc-700">
                    <MapPin className="w-4 h-4" /> {areaName}
                  </button>
                  <Link href="/services" className="py-2 text-base">{nav.allServices}</Link>
                  {[...nav.links, ...nav.mobileLinks].map((n) => (
                    <Link key={n.href} href={n.href} className="py-2 text-base text-zinc-700">{n.label}</Link>
                  ))}
                  <Link href="/login" className="py-2 text-base text-zinc-700">{nav.login}</Link>
                  {showLang && (
                    <NextLink href={langHref(pathname)} hrefLang={locale === "en" ? "ur" : "en"} lang={locale === "en" ? "ur" : "en"} className={cn("py-2 text-base text-zinc-700", locale === "en" && "font-urdu")}>
                      {t.common.language}
                    </NextLink>
                  )}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <LocationDialog open={locOpen} onOpenChange={setLocOpen} />
    </>
  )
}
