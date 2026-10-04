"use client"

import { useState } from "react"
import Link from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { Check, Loader2, Star } from "lucide-react"
import { RATING_TAGS } from "@/lib/ops/types"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"

const RATED_KEY = "mjazo-rated"
const LABEL = ["", "Not good", "Could be better", "Okay", "Good", "Loved it"]

export function isRated(id: string) {
  try {
    return (JSON.parse(localStorage.getItem(RATED_KEY) ?? "[]") as string[]).includes(id)
  } catch {
    return false
  }
}
function markRated(id: string) {
  try {
    const l = JSON.parse(localStorage.getItem(RATED_KEY) ?? "[]") as string[]
    localStorage.setItem(RATED_KEY, JSON.stringify([...new Set([...l, id])].slice(-200)))
  } catch {}
}

/** Stars + quick tags + an optional comment. Phone is known on the account page, typed on /rate. */
export function RateVisit({ bookingId, phone, beauty, onDone }: { bookingId: string; phone: string; beauty?: boolean; onDone?: () => void }) {
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ low: boolean } | null>(null)
  const options = stars >= 4 ? RATING_TAGS.good.filter((t) => beauty || t !== "The look matched") : stars ? RATING_TAGS.bad : []

  const send = async () => {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, phone, stars, tags, comment }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      markRated(bookingId)
      track("rate_visit", { stars })
      setDone({ low: data.low })
      onDone?.()
    } catch (e) {
      setError((e as Error).message)
      if (/already rated/i.test((e as Error).message)) markRated(bookingId)
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 text-sm">
        <span className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
          <Check className="w-4 h-4" />
        </span>
        <span>Thank you. Your rating helps us coach every pro.</span>
        {done.low && (
          <Link href={`/complaint?id=${encodeURIComponent(bookingId)}`} className="underline underline-offset-4">
            Want us to make it right?
          </Link>
        )}
      </motion.div>
    )

  return (
    <div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rate your visit">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              setStars(n)
              setTags([])
            }}
            className="p-1"
          >
            <Star className={cn("w-8 h-8 transition-all", (hover || stars) >= n ? "fill-brand text-brand scale-110" : "text-zinc-300")} strokeWidth={1.5} />
          </button>
        ))}
        <span className="ms-2 text-sm text-zinc-500">{LABEL[hover || stars]}</span>
      </div>
      {stars > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <div className="flex flex-wrap gap-2 mt-3">
            {options.map((t) => (
              <button key={t} type="button" onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))} aria-pressed={tags.includes(t)} className={cn("h-9 px-3.5 rounded-full border text-sm transition-colors", tags.includes(t) ? "bg-foreground text-background border-foreground" : "border-zinc-300 hover:border-zinc-500")}>
                {t}
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} dir="auto" placeholder={stars >= 4 ? "Anything your pro did especially well? (optional)" : "What went wrong? (optional)"} className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-[16px] sm:text-sm outline-none focus:border-foreground" />
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          <button onClick={send} disabled={busy} className="mt-3 h-11 px-6 rounded-full bg-foreground text-background text-sm inline-flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Send rating
          </button>
        </motion.div>
      )}
    </div>
  )
}
