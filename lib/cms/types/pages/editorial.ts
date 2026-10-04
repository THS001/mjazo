import { f } from "../../fields"
import { cta, head, page, type Cta, type Head } from "./blocks"

// Text around the blog, help centre and legal documents (the articles themselves are collections).

export type BlogContent = { hero: Head; read: string; minRead: string; keepReading: string; cta: Cta }
page<BlogContent>("blog", {
  label: "Blog: index and article template",
  path: "/blog",
  fields: {
    hero: head("Index hero"),
    read: f.text("“Read” link", { width: "third" }),
    minRead: f.text("“min read” label", { width: "third" }),
    keepReading: f.text("“Keep reading” title", { width: "third" }),
    cta: cta("Button under each article"),
  },
  defaults: {
    hero: { eyebrow: "The Mjazo journal", title: "Guides for home, glow and everything between.", sub: "" },
    read: "Read",
    minRead: "min read",
    keepReading: "Keep reading",
    cta: { label: "Explore services", href: "/services" },
  },
})

export type HelpContent = { title: string; introBefore: string; whatsapp: string; whatsappMessage: string; search: string; answer: string; answers: string; noAnswers: string; stuck: string; topicMessage: string }
page<HelpContent>("help", {
  label: "Help centre",
  path: "/help",
  fields: {
    title: f.text("Headline", { required: true }),
    introBefore: f.text("Intro, before the WhatsApp link"),
    whatsapp: f.text("WhatsApp link text", { width: "half" }),
    whatsappMessage: f.text("WhatsApp message", { width: "half" }),
    search: f.text("Search placeholder"),
    answer: f.text("“answer” (one)", { width: "half" }),
    answers: f.text("“answers” (several)", { width: "half" }),
    noAnswers: f.text("No results message", { width: "half" }),
    stuck: f.text("“Still stuck?” line (topic pages)", { width: "half" }),
    topicMessage: f.text("WhatsApp message from a topic", { width: "half", help: "{{topic}} becomes the topic name." }),
  },
  defaults: {
    title: "How can we help?",
    introBefore: "Search, browse a topic, or",
    whatsapp: "WhatsApp us",
    whatsappMessage: "Hi Mjazo, I need help.",
    search: "Search: cancel, payment, wax, CNIC…",
    answer: "answer",
    answers: "answers",
    noAnswers: "No answers matched. Try another word, or message us on WhatsApp.",
    stuck: "Still stuck?",
    topicMessage: "Hi Mjazo, I have a question about {{topic}}.",
  },
})

export type LegalLabels = { policies: string; onThisPage: string; updated: string }
page<LegalLabels>("legal", {
  label: "Legal pages: labels",
  path: "/terms",
  description: "Labels around the legal documents. The documents themselves are under Legal.",
  fields: { policies: f.text("Sidebar title", { width: "third" }), onThisPage: f.text("Contents title", { width: "third" }), updated: f.text("“Last updated” label", { width: "third" }) },
  defaults: { policies: "Policies", onThisPage: "On this page", updated: "Last updated" },
})
