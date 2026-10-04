"use client"

import { useState } from "react"
import { ArrowUp, Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Empty } from "../kit"

const EXAMPLES = [
  "How many bookings did we have this week, and what share came from the Concierge?",
  "Which pros are below 2 visits per working day this week?",
  "Is any cash unreconciled? List the jobs.",
  "Which area had the most cancellations in the last 14 days?",
  "Plan tomorrow: can everything be assigned?",
  "Which pros are slipping on quality, and what should we coach?",
  "Any regular customers who went quiet this month?",
]

export function AskOps({ ai }: { ai: boolean }) {
  const [q, setQ] = useState("")
  const [log, setLog] = useState<{ q: string; a?: string; error?: string }[]>([])
  const [busy, setBusy] = useState(false)
  const ask = async (question: string) => {
    if (!question.trim() || busy) return
    setQ("")
    setBusy(true)
    setLog((l) => [{ q: question }, ...l])
    try {
      const { answer } = await api<{ answer: string }>("/api/ops/ask", { question })
      setLog((l) => [{ q: question, a: answer }, ...l.slice(1)])
    } catch (e) {
      setLog((l) => [{ q: question, error: (e as Error).message }, ...l.slice(1)])
    } finally {
      setBusy(false)
    }
  }
  if (!ai) return <Empty title="Ask AI is off" body="Set ANTHROPIC_API_KEY in the deployment to switch on the ops analyst." />
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center">
        <span className="w-14 h-14 rounded-2xl bg-black text-[var(--brand)] inline-flex items-center justify-center">
          <Bot className="w-7 h-7" />
        </span>
        <h2 className="font-serif text-4xl mt-5">Ask the business anything</h2>
        <p className="text-zinc-500 mt-2">Plain-language questions over bookings, pros, payments and complaints. Read-only: it never changes data.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(q)
        }}
        className="mt-8 relative"
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              ask(q)
            }
          }}
          rows={2}
          placeholder="e.g. Which pros had the most completed visits last week?"
          className="w-full rounded-[28px] border border-black/10 bg-white pl-5 pr-16 py-4 text-[16px] outline-none focus:border-black resize-none shadow-[0_10px_40px_-25px_rgba(0,0,0,0.3)]"
        />
        <button disabled={busy || !q.trim()} aria-label="Ask" className="absolute right-3 bottom-4 w-11 h-11 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-30">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
        </button>
      </form>
      {!log.length && (
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {EXAMPLES.map((x) => (
            <button key={x} onClick={() => ask(x)} className="px-4 py-2 rounded-full border border-black/10 bg-white text-sm text-zinc-700 hover:border-black/30 text-left">
              {x}
            </button>
          ))}
        </div>
      )}
      <div className="mt-8 space-y-4">
        {log.map((x, i) => (
          <div key={log.length - i} className="rounded-3xl bg-white border border-black/[0.06] p-5 sm:p-6">
            <p className="font-medium">{x.q}</p>
            {x.a ? (
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-800 whitespace-pre-wrap">{x.a}</p>
            ) : x.error ? (
              <p className="mt-3 text-sm text-red-600">{x.error}</p>
            ) : (
              <p className={cn("mt-3 text-sm text-zinc-500 flex items-center gap-2")}>
                <Loader2 className="w-4 h-4 animate-spin" /> Looking through the data…
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
