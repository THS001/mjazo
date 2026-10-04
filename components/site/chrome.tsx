"use client"

import Link from "@/components/site/locale-link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Lenis from "lenis"
import { CalendarCheck, Home, LayoutGrid, Search, User } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { captureAttribution, track } from "@/lib/site"
import { cartCount, cartTotal, useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { fill, useNav, useSite, useT } from "@/components/cms/provider"
import { stripLocale } from "@/lib/i18n"

/** Lenis smooth scroll (lerp 0.1, matching the template) + first-touch attribution capture. */
export function SmoothScroll() {
  const pathname = stripLocale(usePathname())
  useEffect(() => {
    captureAttribution()
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const lenis = new Lenis({ lerp: 0.1 })
    ;(window as unknown as { lenis?: Lenis }).lenis = lenis
    let id = 0
    const raf = (t: number) => {
      lenis.raf(t)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)
    // Pause smooth scrolling while a dialog/drawer locks the page (Radix sets data-scroll-locked).
    const mo = new MutationObserver(() => (document.body.hasAttribute("data-scroll-locked") ? lenis.stop() : lenis.start()))
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] })
    return () => {
      mo.disconnect()
      cancelAnimationFrame(id)
      lenis.destroy()
    }
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** /services/[category]/[service] has its own mobile purchase bar. */
export const isServiceDetail = (p: string) => /^\/services\/(?!w\/)[^/]+\/[^/]+$/.test(p)

export function WhatsAppFab() {
  const { whatsappLink } = useSite()
  const pathname = stripLocale(usePathname())
  if (pathname.startsWith("/checkout")) return null
  return (
    <a
      href={whatsappLink(`Hi Mjazo! I have a question (from ${pathname}).`)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_click", { placement: "fab", page: pathname })}
      className={cn("fixed z-40 end-4 lg:bottom-6 w-14 h-14 rounded-full bg-[#25D366] text-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform", isServiceDetail(pathname) ? "bottom-[calc(8.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(5rem+env(safe-area-inset-bottom))]")}
      aria-label="Chat on WhatsApp"
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden>
        <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
      </svg>
    </a>
  )
}

const TABS = [
  { href: "/", key: "home", icon: Home },
  { href: "/services", key: "services", icon: LayoutGrid },
  { href: "#search", key: "search", icon: Search },
  { href: "/account/bookings", key: "bookings", icon: CalendarCheck },
  { href: "/account", key: "account", icon: User },
] as const

/** Mobile bottom tab bar + sticky "View cart" bar. */
export function MobileBar() {
  const pathname = stripLocale(usePathname())
  const { tabs } = useNav()
  const t = useT()
  const { items, setOpen } = useCart()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const count = mounted ? cartCount(items) : 0
  const hideCartBar = pathname.startsWith("/checkout") || pathname.startsWith("/cart") || isServiceDetail(pathname)

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
      {count > 0 && !hideCartBar && (
        <div className="px-3 pb-2">
          <button onClick={() => setOpen(true)} className="w-full h-12 rounded-full bg-foreground text-background flex items-center justify-between px-5 text-sm shadow-lg">
            <span>{fill(count > 1 ? t.cart.items : t.cart.item, { count })} · {formatPKR(cartTotal(items))}</span>
            <span className="font-medium">{t.cart.viewCartArrow}</span>
          </button>
        </div>
      )}
      <nav className="bg-white/90 backdrop-blur-xl border-t border-zinc-200 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href)
          const cls = cn("flex flex-col items-center justify-center gap-0.5 min-h-14 py-1.5 text-[11px]", active ? "text-black" : "text-zinc-500")
          if (t.href === "#search")
            return (
              <button key={t.key} className={cls} onClick={() => window.dispatchEvent(new Event("mjazo:search"))}>
                <t.icon className="w-5 h-5" strokeWidth={1.5} />
                {tabs[t.key]}
              </button>
            )
          return (
            <Link key={t.key} href={t.href} className={cls}>
              <t.icon className="w-5 h-5" strokeWidth={1.5} />
              {tabs[t.key]}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
