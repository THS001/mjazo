import { helpTopics, legal, posts, type HelpTopic, type LegalDoc, type Post } from "@/lib/content"
import { docFrom, f, type RichDoc } from "../fields"
import { register } from "../registry"

// Editorial collections: blog posts, help-centre topics and legal documents.

export type PostSite = Omit<Post, "body"> & { body: RichDoc }
export const postType = register<PostSite, PostSite>({
  type: "post",
  label: "Post",
  plural: "Posts",
  group: "Blog",
  kind: "collection",
  icon: "BookOpen",
  description: "Journal articles and guides at /blog.",
  columns: [
    { key: "tag", label: "Tag" },
    { key: "date", label: "Date" },
  ],
  fields: {
    title: f.text("Title", { required: true, max: 90 }),
    slug: f.slug(),
    excerpt: f.textarea("Excerpt", { max: 200, help: "One or two sentences for the blog index and search results." }),
    tag: f.text("Tag", { width: "third", help: "e.g. Beauty, Home, Safety" }),
    date: f.date("Date", { width: "third" }),
    minutes: f.number("Reading time", { unit: "min", min: 1, width: "third" }),
    tint: f.color("Card colour"),
    cover: f.image("Cover image", { help: "Shown on the blog index and at the top of the article. Without one, the card colour shows." }),
    body: f.richText("Article"),
  },
  defaults: () => posts.map((p) => ({ ...p, body: docFrom(p.body) })),
  idOf: (p) => p.slug,
  titleOf: (p) => p.title,
  path: (p) => `/blog/${p.slug}`,
})

type HelpCms = Omit<HelpTopic, "articles"> & { articles: { q: string; a: string }[] }
export const helpType = register<HelpTopic, HelpCms>({
  type: "help-topic",
  label: "Help topic",
  plural: "Help topics",
  group: "Help",
  kind: "collection",
  icon: "HelpCircle",
  description: "Help-centre topics and their questions. The Safety and Partner pages reuse the “safety” and “for-pros” topics.",
  fields: {
    title: f.text("Title", { required: true, max: 40 }),
    slug: f.slug(),
    icon: f.icon("Icon"),
    blurb: f.text("Short description", { max: 80 }),
    articles: f.list("Questions", f.group("Question", { q: f.text("Question", { required: true }), a: f.textarea("Answer", { required: true }) }), { itemLabel: "q" }),
  },
  defaults: () => helpTopics,
  idOf: (t) => t.slug,
  toCms: (t) => ({ ...t, articles: t.articles.map(([q, a]) => ({ q, a })) }),
  toSite: (t) => ({ ...t, articles: (t.articles ?? []).map(({ q, a }) => [q, a] as [string, string]) }),
  titleOf: (t) => t.title,
  path: (t) => `/help/${t.slug}`,
})

const toIso = (s: string) => {
  const d = new Date(`${s} UTC`)
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
}
export const legalType = register<LegalDoc, LegalDoc>({
  type: "legal",
  label: "Legal document",
  plural: "Legal documents",
  group: "Legal",
  kind: "collection",
  icon: "ScrollText",
  description: "Terms, privacy, cancellation and the pro code of conduct. Have a lawyer review changes. The “last updated” date is set when you publish.",
  columns: [{ key: "updated", label: "Last updated" }],
  fields: {
    title: f.text("Title", { required: true }),
    slug: f.slug(),
    updated: f.date("Last updated", { help: "Set automatically when you publish." }),
    sections: f.list("Sections", f.group("Section", { h: f.text("Heading", { required: true }), p: f.textarea("Text", { required: true, help: "Leave a blank line between paragraphs." }) }), { itemLabel: "h" }),
  },
  defaults: () => Object.values(legal).map((d) => ({ ...d, updated: toIso(d.updated) })),
  idOf: (d) => d.slug,
  titleOf: (d) => d.title,
  path: (d) => `/${d.slug}`,
  beforePublish: (data) => ({ ...data, updated: new Date().toISOString().slice(0, 10) }),
})
