import { docFrom, f, type BlockDef, type Img, type RichDoc } from "../fields"
import { register } from "../registry"
import { PATH_PATTERN, pathProblems, pathToId } from "../block-paths"
import { ctaList, faqs, lines } from "./pages/blocks"
import { seoGroup, type Seo } from "./seo"

// Block pages: new pages at any free address (campaigns, landing pages, partnerships), built from
// blocks that reuse the site's own components. Served by app/[locale]/[...slug]; rendered by
// components/cms/blocks.tsx. Every block's text is translatable like the rest of the site.

const tone = f.select(
  "Background",
  [
    { value: "light", label: "Paper (light)" },
    { value: "dark", label: "Ink (dark)" },
    { value: "saffron", label: "Saffron" },
    { value: "blush", label: "Blush" },
  ],
  { width: "half" },
)
const anchor = f.code("Anchor", {
  width: "half",
  help: "Optional. Buttons can link straight here with #anchor, e.g. #enquire.",
  pattern: { re: "^[a-z0-9-]*$", message: "Use lowercase letters, numbers and hyphens" },
})
const columns = f.select("Columns", ["2", "3", "4"], { width: "half" })
const title = (required = false) => f.text("Title", { required, help: "*Asterisks* around a word show it in the italic accent." })

export const BLOCKS: Record<string, BlockDef> = {
  hero: {
    label: "Hero",
    icon: "LayoutTemplate",
    help: "The big heading at the top of the page.",
    fields: {
      eyebrow: f.text("Eyebrow", { help: "Small capitals above the title. Optional." }),
      title: title(true),
      sub: f.textarea("Intro"),
      image: f.image("Image", { help: "Shown beside the heading. Optional." }),
      buttons: ctaList("Buttons"),
      tone,
      center: f.boolean("Centre the text", { help: "Only when there's no image." }),
      anchor,
    },
    starter: { title: "A headline for *this* page", sub: "One or two sentences that say what this page is about and why it matters.", tone: "light", center: false, buttons: [{ label: "Book now", href: "/services" }] },
  },
  text: {
    label: "Text",
    icon: "Type",
    help: "Paragraphs, headings, lists and links.",
    fields: { title: title(), body: f.richText("Text"), width: f.select("Width", [{ value: "narrow", label: "Narrow (easy reading)" }, { value: "wide", label: "Wide" }], { width: "half" }), tone, anchor },
    starter: { title: "", body: docFrom([{ p: "Write your text here. Use the toolbar for headings, lists and links." }]), width: "narrow", tone: "light" },
  },
  imageText: {
    label: "Image and text",
    icon: "Columns2",
    help: "A photo beside a heading, text and a button.",
    fields: {
      image: f.image("Image"),
      eyebrow: f.text("Eyebrow"),
      title: title(),
      body: f.textarea("Text"),
      buttonLabel: f.text("Button label", { width: "half" }),
      buttonHref: f.code("Button link", { width: "half", help: "A page like /services, #anchor, or a full https:// address." }),
      imageSide: f.select("Image side", [{ value: "left", label: "Left" }, { value: "right", label: "Right" }], { width: "half" }),
      tone,
      anchor,
    },
    starter: { title: "A heading beside the *picture*", body: "A few sentences about it. Choose a photo from the media library.", imageSide: "left", tone: "light" },
  },
  cards: {
    label: "Cards",
    icon: "LayoutGrid",
    help: "A grid of short points, each with an icon.",
    fields: {
      eyebrow: f.text("Eyebrow"),
      title: title(),
      sub: f.textarea("Intro"),
      columns,
      items: f.list("Cards", f.group("Card", { icon: f.icon("Icon"), title: f.text("Title", { required: true }), body: f.textarea("Text"), href: f.code("Link", { help: "Optional: makes the card a link." }) }), { itemLabel: "title" }),
      tone,
      anchor,
    },
    starter: {
      title: "Why families choose Mjazo",
      columns: "3",
      tone: "light",
      items: [
        { icon: "ShieldCheck", title: "Verified pros", body: "CNIC and background checks, trained and rated." },
        { icon: "Wallet", title: "All-in prices", body: "What you see is what you pay. No surprises at the door." },
        { icon: "BadgeCheck", title: "Pay after", body: "Cash, JazzCash, Easypaisa or Raast, once the job is done." },
      ],
    },
  },
  services: {
    label: "Services",
    icon: "Tag",
    help: "Bookable service cards, from the catalogue.",
    fields: {
      eyebrow: f.text("Eyebrow"),
      title: title(),
      sub: f.textarea("Intro"),
      source: f.select(
        "Which services",
        [
          { value: "pick", label: "The ones I pick" },
          { value: "category", label: "A whole category" },
          { value: "popular", label: "Most booked" },
        ],
        { width: "half" },
      ),
      limit: f.number("At most", { min: 1, max: 12, width: "half", help: "For a category or most booked." }),
      category: f.ref("Category", "category", { help: "When showing a whole category." }),
      services: f.list("Services", f.ref("Service", "service"), { help: "When picking services." }),
      tone,
      anchor,
    },
    starter: { title: "Most booked", source: "popular", limit: 4, category: "womens-salon", services: [], tone: "light" },
  },
  faq: {
    label: "Questions",
    icon: "HelpCircle",
    help: "Questions and answers (Google can show them in results).",
    fields: { title: f.text("Title", { help: "Empty: “Common questions”." }), items: faqs("Questions"), anchor },
    starter: { title: "", items: [{ q: "A question customers ask", a: "A short, clear answer." }] },
  },
  cta: {
    label: "Call to action",
    icon: "Megaphone",
    help: "A bold band with a heading and buttons.",
    fields: { title: title(true), sub: f.textarea("Text"), buttons: ctaList("Buttons"), tone, anchor },
    starter: { title: "Ready when *you* are", sub: "Book in two minutes and pay after the service.", buttons: [{ label: "Book now", href: "/services" }], tone: "dark" },
  },
  promises: {
    label: "Promises strip",
    icon: "ShieldCheck",
    help: "Two moving rows of short promises.",
    fields: { eyebrow: f.text("Eyebrow"), title: title(), sub: f.textarea("Intro"), items: lines("Promises", { help: "Short lines. They're split across two rows." }) },
    starter: {
      title: "Our promises",
      items: ["Verified pros", "All-in prices", "Pay after the service", "Free redo within {{policy.redoHours}} hours", "Women-only beauty pros", "Sealed single-use kits"],
    },
  },
  stats: {
    label: "Numbers",
    icon: "ChartColumn",
    help: "Big numbers with short labels.",
    fields: {
      title: title(),
      items: f.list("Numbers", f.group("Number", { value: f.text("Number", { required: true, help: "e.g. 8, 132+, 100% or {{catalog.areaCount}}" }), label: f.text("Label", { required: true }) }), { itemLabel: "label", max: 6 }),
      tone,
      anchor,
    },
    starter: {
      tone: "light",
      items: [
        { value: "{{catalog.areaCount}}", label: "Karachi areas" },
        { value: "{{catalog.serviceCount}}+", label: "Services" },
        { value: "100%", label: "Verified pros" },
      ],
    },
  },
  video: {
    label: "Video",
    icon: "Film",
    help: "A video from the media library.",
    fields: {
      video: f.video("Video"),
      poster: f.image("Poster image", { help: "Shown before it plays." }),
      caption: f.text("Caption"),
      autoplay: f.boolean("Play silently on a loop", { help: "Like the home page video. Off: it plays with controls." }),
      anchor,
    },
    starter: { autoplay: false },
  },
  gallery: {
    label: "Gallery",
    icon: "Images",
    help: "A grid of photos.",
    fields: { title: title(), images: f.list("Photos", f.image("Photo")), columns, anchor },
    starter: { columns: "3", images: [] },
  },
  form: {
    label: "Enquiry form",
    icon: "MessageSquareText",
    help: "Name, phone and a message, sent to the team like the site's other forms.",
    fields: {
      eyebrow: f.text("Eyebrow"),
      title: title(),
      sub: f.textarea("Intro"),
      askDate: f.boolean("Ask for a date", { width: "half" }),
      askArea: f.boolean("Ask for their area", { width: "half" }),
      whatsapp: f.boolean("Offer WhatsApp instead", { width: "half" }),
      submitLabel: f.text("Button label", { width: "half", help: "Empty: “Send”." }),
      success: f.textarea("Thank-you message", { help: "Empty: the standard message." }),
      tone,
      anchor,
    },
    starter: { title: "Tell us what you need", sub: "Leave your number and we'll call you back.", askDate: false, askArea: true, whatsapp: true, tone: "light", anchor: "enquire" },
  },
  spacer: {
    label: "Spacer",
    icon: "SeparatorHorizontal",
    help: "Space between blocks, with an optional line.",
    fields: { size: f.select("Size", [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }], { width: "half" }), line: f.boolean("Show a line", { width: "half" }) },
    starter: { size: "md", line: false },
  },
}

/** A block as the site receives it: its kind, key and resolved fields. */
export type SiteBlock = { _type: string; _key: string } & Record<string, unknown>
export type BlockPage = { title: string; path: string; description?: string; blocks: SiteBlock[]; seo?: Seo }
export type { Img, RichDoc }

register<BlockPage, BlockPage>({
  type: "block-page",
  label: "Block page",
  plural: "Block pages",
  group: "Pages",
  kind: "collection",
  icon: "LayoutGrid",
  description: "New pages at any free address (campaigns, landing pages, partnerships), built from blocks. Preview them live as you edit.",
  columns: [{ key: "path", label: "Address" }],
  fields: {
    title: f.text("Page name", { required: true, max: 70, help: "Shown in the admin, and used as the search title unless the SEO group has one." }),
    path: f.code("Address", {
      required: true,
      help: "Where the page lives, e.g. /eid-sale or /campaigns/eid-sale. The Urdu version is at /ur/… automatically.",
      pattern: { re: PATH_PATTERN, message: "Start with / and use lowercase letters, numbers and hyphens, e.g. /eid-sale" },
    }),
    description: f.textarea("Summary", { max: 160, help: "One or two sentences for Google and link previews, unless the SEO group has its own." }),
    blocks: f.blocks("Blocks", BLOCKS, { help: "The page from top to bottom. Add blocks, drag them into order, duplicate or remove them." }),
    seo: seoGroup(),
  },
  defaults: () => [],
  idOf: (p) => pathToId(p.path),
  newId: (d) => pathToId(d.path),
  unique: { key: "path", label: "Address" },
  check: (d) => pathProblems(d.path),
  titleOf: (p) => p.title,
  path: (p) => p.path,
})
