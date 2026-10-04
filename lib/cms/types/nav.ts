import { f } from "../fields"
import { register } from "../registry"
import { cta, type Cta } from "./pages/blocks"

// Header, mobile tab bar and footer. One singleton (`nav`), read in the root layout and handed to
// the header and tab bar through CmsProvider (useNav()) and to the footer as a prop.

export type NavLink = { label: string; href: string }
export type FooterColumn = { title: string; auto: "none" | "worlds" | "areas"; links: NavLink[] }
export type NavContent = {
  header: { services: string; links: NavLink[]; megaNote: string; allServices: string; soon: string; selectArea: string; login: string; book: Cta; mobileLinks: NavLink[] }
  tabs: { home: string; services: string; search: string; bookings: string; account: string }
  footer: { banner: { title: string; line: string; urdu: string; cta: Cta }; tagline: string; columns: FooterColumn[]; areaLink: string; copyright: string; note: string }
}

const links = (label: string, help?: string) =>
  f.list(label, f.group("Link", { label: f.text("Label", { required: true, width: "half" }), href: f.code("Link", { required: true, width: "half" }) }), { itemLabel: "label", help })

export const NAV_DEFAULTS: NavContent = {
  header: {
    services: "Services",
    links: [
      { label: "Offers", href: "/offers" },
      { label: "Plus", href: "/plus" },
      { label: "Safety", href: "/safety" },
      { label: "Become a Pro", href: "/partner" },
    ],
    megaNote: "Every service, bookable across {{catalog.areaCount}} Karachi neighbourhoods. All-in prices, pay after.",
    allServices: "All services",
    soon: "soon",
    selectArea: "Select area",
    login: "Log in",
    book: { label: "Book now", href: "/services/w/beauty-wellness" },
    mobileLinks: [
      { label: "Areas", href: "/karachi" },
      { label: "Help", href: "/help" },
    ],
  },
  tabs: { home: "Home", services: "Services", search: "Search", bookings: "Bookings", account: "Account" },
  footer: {
    banner: { title: "Are you a beautician?", line: "Your skills. Your schedule. Better pay.", urdu: "اپنی مہارت، اپنا وقت، بہتر کمائی", cta: { label: "Join Mjazo", href: "/partner" } },
    tagline: "Everything your home needs, in one tap. Built in Karachi, for Karachi.",
    columns: [
      { title: "Services", auto: "worlds", links: [{ label: "All services", href: "/services" }] },
      {
        title: "Company",
        auto: "none",
        links: [
          { label: "About", href: "/about" },
          { label: "Safety & trust", href: "/safety" },
          { label: "How it works", href: "/how-it-works" },
          { label: "Careers", href: "/careers" },
          { label: "Mjazo for Business", href: "/business" },
          { label: "Weddings & events", href: "/weddings" },
          { label: "Journal", href: "/blog" },
        ],
      },
      {
        title: "Explore",
        auto: "areas",
        links: [
          { label: "Ghar Scan (AI)", href: "/ghar-scan" },
          { label: "Home Pulse (AI)", href: "/home-pulse" },
          { label: "Glam Mirror (AI)", href: "/glam-mirror" },
          { label: "Shaadi Orchestrator (AI)", href: "/weddings/planner" },
          { label: "Offers & bundles", href: "/offers" },
          { label: "Mjazo Plus", href: "/plus" },
          { label: "Gift cards", href: "/gift-cards" },
          { label: "Refer & earn", href: "/refer" },
          { label: "Get the app", href: "/app" },
          { label: "Areas we cover", href: "/karachi" },
        ],
      },
      {
        title: "Support",
        auto: "none",
        links: [
          { label: "Help centre", href: "/help" },
          { label: "Report a problem", href: "/complaint" },
          { label: "Contact", href: "/contact" },
          { label: "Cancellation & refunds", href: "/cancellation-refund" },
          { label: "Terms", href: "/terms" },
          { label: "Privacy", href: "/privacy" },
          { label: "Pro code of conduct", href: "/pro-code-of-conduct" },
        ],
      },
    ],
    areaLink: "Mjazo in {{area}}",
    copyright: "© {{year}} Mjazo. Karachi, Pakistan.",
    note: "Prices shown are all-in. Pay after your service.",
  },
}

register<NavContent, NavContent>({
  type: "nav",
  label: "Header & footer",
  group: "Navigation",
  kind: "singleton",
  icon: "Navigation",
  description: "The menus and links at the top and bottom of every page, and the mobile tab bar. The Services mega menu lists the worlds and categories from the Catalogue.",
  fields: {
    header: f.group("Header", {
      services: f.text("Services menu label", { width: "half" }),
      allServices: f.text("“All services” link", { width: "half" }),
      links: links("Menu links", "Shown after Services on desktop and in the mobile menu."),
      megaNote: f.text("Note under the Services menu"),
      soon: f.text("“Coming soon” tag", { width: "third" }),
      selectArea: f.text("Area button (none chosen)", { width: "third" }),
      login: f.text("Log in", { width: "third" }),
      book: cta("Book button"),
      mobileLinks: links("Extra mobile-menu links"),
    }),
    tabs: f.group("Mobile tab bar", {
      home: f.text("Home", { width: "third" }),
      services: f.text("Services", { width: "third" }),
      search: f.text("Search", { width: "third" }),
      bookings: f.text("Bookings", { width: "third" }),
      account: f.text("Account", { width: "third" }),
    }),
    footer: f.group("Footer", {
      banner: f.group("Join banner", { title: f.text("Title", { width: "half" }), line: f.text("Line", { width: "half" }), urdu: f.text("Urdu line", { localized: false }), cta: cta("Button") }),
      tagline: f.textarea("Tagline under the logo"),
      columns: f.list(
        "Link columns",
        f.group("Column", {
          title: f.text("Title", { required: true, width: "half" }),
          auto: f.select("Add automatically", [{ value: "none", label: "Nothing" }, { value: "worlds", label: "Every service world, first" }, { value: "areas", label: "Two area pages, last" }], { width: "half" }),
          links: links("Links"),
        }),
        { itemLabel: "title", max: 4 },
      ),
      areaLink: f.text("Area page link", { width: "half", help: "{{area}} becomes the area's name." }),
      copyright: f.text("Copyright line", { width: "half", help: "{{year}} becomes this year." }),
      note: f.text("Note in the bottom row"),
    }),
  },
  defaults: () => NAV_DEFAULTS,
  path: () => "/",
})
