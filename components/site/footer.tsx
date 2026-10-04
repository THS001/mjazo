import Link from "@/components/site/locale-link"
import { Instagram, Mail, MessageCircle } from "lucide-react"
import { Logo } from "./header"
import { Pill } from "./primitives"
import { waLink, type Settings } from "@/lib/site"
import type { Area, World } from "@/lib/catalog"
import { renderTokens } from "@/lib/cms/fields"
import type { FooterColumn, NavContent } from "@/lib/cms/types/nav"

/** Footer columns from the CMS, with the automatic world and area links filled in. */
const footerCols = (columns: FooterColumn[], areaLink: string, worlds: World[], liveAreas: Area[]) =>
  columns.map((col) => ({
    title: col.title,
    links: [
      ...(col.auto === "worlds" ? worlds.map((w) => ({ label: w.name, href: `/services/w/${w.slug}` })) : []),
      ...col.links,
      ...(col.auto === "areas" ? liveAreas.slice(0, 2).map((a) => ({ label: renderTokens(areaLink, { area: a.name }), href: `/karachi/${a.slug}` })) : []),
    ],
  }))

/** Karachi sunset over the sea, with a skyline silhouette: replaces the template's footer photo. */
function Skyline() {
  return (
    <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute bottom-0 start-0 w-full h-[40%] text-background" aria-hidden>
      <path
        fill="currentColor"
        d="M0 200V150h40v-20h30v20h25v-45h20v45h40v-30h18v-25h12v25h20v55h35v-70h14v-18h10v18h16v70h30v-40h45v-25h20v25h15v40h40v-60l18-12 18 12v60h30v-35h24v-30h8v30h20v35h40v-85h30v85h25v-50h20v-20h20v20h12v50h35v-30h45v30h20V95h10V80h6v15h10v65h30v-40h25v40h40v-55h35v55h20v-25h30v-20h14v45h40v-70h22v70h25v-35h40v35h35v-48h25v-20h12v68h40v-30h40v30h30v-58h20v58h40v-25h30V200z"
      />
    </svg>
  )
}

export function Footer({ worlds, liveAreas, site, nav, locale = "en" }: { worlds: World[]; liveAreas: Area[]; site: Settings["site"]; nav: NavContent["footer"]; locale?: "en" | "ur" }) {
  const whatsappLink = (message: string) => waLink(site.whatsapp, message)
  const cols = footerCols(nav.columns, nav.areaLink, worlds, liveAreas)
  return (
    <div className="relative mt-[22vw] md:mt-[18vw]">
      <div className="absolute -top-[22vw] md:-top-[18vw] start-0 end-0 h-[40vw] md:h-[32vw] overflow-hidden" aria-hidden>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, oklch(0.93 0.05 75) 0%, oklch(0.84 0.12 65) 38%, oklch(0.74 0.12 40) 62%, oklch(0.55 0.06 230) 100%)" }} />
        <div className="absolute left-1/2 top-[34%] -translate-x-1/2 w-[18vw] h-[18vw] rounded-full" style={{ background: "radial-gradient(circle, oklch(0.97 0.08 85), oklch(0.88 0.14 70) 60%, transparent 70%)" }} />
        <Skyline />
      </div>
      <div className="absolute -top-[17vw] md:-top-[14vw] start-0 end-0 flex justify-center pointer-events-none z-10" aria-hidden>
        <span className="font-bold text-[28vw] sm:text-[25vw] md:text-[22vw] lg:text-[20vw] leading-[0.85] tracking-tighter text-white/95 whitespace-nowrap">MJAZO</span>
      </div>

      <footer className="relative z-20 bg-background border-t border-border pt-14 pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl bg-foreground text-background p-8 md:p-10 mb-14 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="font-serif text-3xl md:text-4xl">{nav.banner.title}</p>
              <p className="text-white/70 mt-2" dir="auto">{nav.banner.line}{nav.banner.urdu && locale === "en" && <> · <span className="font-urdu">{nav.banner.urdu}</span></>}</p>
            </div>
            <Pill href={nav.banner.cta.href} variant="brand">{nav.banner.cta.label}</Pill>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Logo className="mb-4" />
              <p className="text-sm text-muted-foreground mb-6">{nav.tagline}</p>
              <div className="flex gap-3">
                <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
                <a href={whatsappLink("Hi Mjazo!")} target="_blank" rel="noopener noreferrer" className="w-9 h-9 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="WhatsApp"><MessageCircle className="w-4 h-4" /></a>
                <a href={`mailto:${site.email}`} className="w-9 h-9 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Email"><Mail className="w-4 h-4" /></a>
              </div>
            </div>
            {cols.map(({ title, links }) => (
              <div key={title}>
                <p className="text-sm font-medium mb-4">{title}</p>
                <ul className="space-y-0.5">
                  {links.map((l) => (
                    <li key={l.href}><Link href={l.href} className="inline-block py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between gap-3 text-xs text-muted-foreground">
            <p>{renderTokens(nav.copyright, { year: new Date().getFullYear() })}</p>
            <p>{nav.note}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
