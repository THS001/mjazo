"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpRight, Search } from "lucide-react"
import type { HelpTopic } from "@/lib/content"
import { Container, Icon } from "./primitives"

export function HelpSearch({ topics: helpTopics, labels }: { topics: HelpTopic[]; labels: { search: string; answer: string; answers: string; noAnswers: string } }) {
  const [q, setQ] = useState("")
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return helpTopics.flatMap((topic) => topic.articles.filter(([a, b]) => `${a} ${b}`.toLowerCase().includes(t)).map(([a, b]) => ({ topic, q: a, a: b })))
  }, [q, helpTopics])

  return (
    <Container className="py-12">
      <div className="flex items-center gap-3 h-16 rounded-full border border-zinc-300 bg-white px-6 max-w-2xl -mt-20 relative shadow-[0_20px_40px_-25px_rgba(0,0,0,0.3)] focus-within:border-foreground">
        <Search className="w-5 h-5 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} aria-label="Search help" className="flex-1 bg-transparent outline-none text-[16px] sm:text-lg" />
      </div>

      {q.trim().length >= 2 ? (
        <div className="mt-10 max-w-3xl space-y-3">
          <p className="text-sm text-zinc-500">{hits.length} {hits.length === 1 ? labels.answer : labels.answers}</p>
          {hits.map((h) => (
            <div key={h.q} className="rounded-3xl bg-white border border-zinc-200 p-6">
              <p className="text-xs text-zinc-400 mb-1">{h.topic.title}</p>
              <p className="font-medium">{h.q}</p>
              <p className="text-sm text-zinc-600 mt-2">{h.a}</p>
            </div>
          ))}
          {hits.length === 0 && <p className="text-zinc-500">{labels.noAnswers}</p>}
        </div>
      ) : (
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {helpTopics.map((t) => (
            <Link key={t.slug} href={`/help/${t.slug}`} className="group rounded-3xl bg-white border border-zinc-200 p-7 hover:border-zinc-400 transition-colors">
              <div className="flex justify-between items-start mb-8">
                <span className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center group-hover:bg-brand transition-colors"><Icon name={t.icon} className="w-6 h-6" /></span>
                <ArrowUpRight className="w-5 h-5 text-zinc-400 group-hover:text-black" />
              </div>
              <p className="text-xl font-medium">{t.title}</p>
              <p className="text-sm text-zinc-500 mt-1">{t.blurb}</p>
              <p className="text-xs text-zinc-400 mt-4">{t.articles.length} {t.articles.length === 1 ? labels.answer : labels.answers}</p>
            </Link>
          ))}
        </div>
      )}
    </Container>
  )
}
