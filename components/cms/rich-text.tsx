import Link from "next/link"
import type { ReactNode } from "react"
import type { RichDoc, RichMark, RichNode } from "@/lib/cms/fields"

// Renders CMS rich text (TipTap JSON) to React. Only known node types are rendered and links are
// limited to http(s), mailto, tel and site paths, so stored content can never inject HTML or script.

const safeHref = (href: unknown) => {
  if (typeof href !== "string") return null
  const h = href.trim()
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(h) ? h : null
}

function withMarks(text: string, marks: RichMark[] | undefined, key: number): ReactNode {
  let out: ReactNode = text
  for (const m of marks ?? []) {
    if (m.type === "bold") out = <strong key={key}>{out}</strong>
    else if (m.type === "italic") out = <em key={key}>{out}</em>
    else if (m.type === "link") {
      const href = safeHref(m.attrs?.href)
      if (!href) continue
      out = href.startsWith("/") ? (
        <Link key={key} href={href} className="underline underline-offset-4 hover:text-brand-ink">
          {out}
        </Link>
      ) : (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-brand-ink">
          {out}
        </a>
      )
    }
  }
  return out
}

function node(n: RichNode, key: number, cls: Classes): ReactNode {
  const kids = (n.content ?? []).map((c, i) => node(c, i, cls))
  switch (n.type) {
    case "text":
      return withMarks(n.text ?? "", n.marks, key)
    case "paragraph":
      return kids.length ? (
        <p key={key} className={cls.p}>
          {kids}
        </p>
      ) : null
    case "heading":
      return Number(n.attrs?.level) >= 3 ? (
        <h3 key={key} className={cls.h3}>
          {kids}
        </h3>
      ) : (
        <h2 key={key} className={cls.h2}>
          {kids}
        </h2>
      )
    case "bulletList":
      return (
        <ul key={key} className={cls.ul}>
          {kids}
        </ul>
      )
    case "orderedList":
      return (
        <ol key={key} className={cls.ol}>
          {kids}
        </ol>
      )
    case "listItem":
      return <li key={key}>{kids}</li>
    case "blockquote":
      return (
        <blockquote key={key} className={cls.quote}>
          {kids}
        </blockquote>
      )
    case "hardBreak":
      return <br key={key} />
    case "horizontalRule":
      return <hr key={key} className="my-8 border-zinc-200" />
    default:
      return kids.length ? <span key={key}>{kids}</span> : null
  }
}

type Classes = { p: string; h2: string; h3: string; ul: string; ol: string; quote: string }
const DEFAULT: Classes = {
  p: "text-lg leading-relaxed text-zinc-700 mt-5",
  h2: "font-serif text-2xl sm:text-3xl mt-10 mb-1",
  h3: "font-semibold text-lg mt-8",
  ul: "mt-5 list-disc space-y-1.5 pl-6 text-lg leading-relaxed text-zinc-700",
  ol: "mt-5 list-decimal space-y-1.5 pl-6 text-lg leading-relaxed text-zinc-700",
  quote: "mt-6 border-l-2 border-brand pl-5 font-serif text-xl italic text-zinc-800",
}

export function RichText({ doc, classes }: { doc: RichDoc | undefined; classes?: Partial<Classes> }) {
  if (!doc?.content?.length) return null
  const cls = { ...DEFAULT, ...classes }
  return <>{doc.content.map((n, i) => node(n, i, cls))}</>
}

