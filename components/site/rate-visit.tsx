"use client"

import { useState } from "react"
import Link from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { Check, Loader2, Star } from "lucide-react"
import { RATING_TAGS } from "@/lib/ops/types"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { fill, useT } from "@/components/cms/provider"
import type { UiStrings } from "@/lib/cms/types/ui"
import { feedbackError } from "./complaint-form"

const RATED_KEY = "mjazo-rated"
// Tags are stored in English (ops reports use them); these are their display names.
const TAG_KEY: Record<string, keyof UiStrings["feedback"]["tags"]> = {
  "On time": "onTime",
  Friendly: "friendly",
  "Clean & hygienic": "clean",
  "Great result": "result",
  "The look matched": "lookMatched",
  Late: "late",
  Rushed: "rushed",
  Messy: "messy",
  "Price changed": "priceChanged",
  "Not what I asked for": "notAsked",
}

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
  const t = useT().feedback
  const level = (n: number) => (n ? t[`level${n}` as "level1"] : "")
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
      if (!res.ok) {
        if (/already rated/i.test(data.error ?? "")) throw Object.assign(new Error(t.alreadyRated), { rated: true })
        throw new Error(feedbackError(t, data, t.sendFailed))
      }
      markRated(bookingId)
      track("rate_visit", { stars })
      setDone({ low: data.low })
      onDone?.()
    } catch (e) {
      setError((e as Error).message)
      if ((e as { rated?: boolean }).rated) markRated(bookingId)
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
        <span>{t.thanks}</span>
        {done.low && (
          <Link href={`/complaint?id=${encodeURIComponent(bookingId)}`} className="underline underline-offset-4">
            {t.makeRight}
          </Link>
        )}
      </motion.div>
    )

  return (
    <div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={t.rateLabel}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={fill(n > 1 ? t.stars : t.star, { n })}
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
        <span className="ms-2 text-sm text-zinc-500">{level(hover || stars)}</span>
      </div>
      {stars > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <div className="flex flex-wrap gap-2 mt-3">
            {options.map((tag) => (
              <button key={tag} type="button" onClick={() => setTags((x) => (x.includes(tag) ? x.filter((y) => y !== tag) : [...x, tag]))} aria-pressed={tags.includes(tag)} className={cn("h-9 px-3.5 rounded-full border text-sm transition-colors", tags.includes(tag) ? "bg-foreground text-background border-foreground" : "border-zinc-300 hover:border-zinc-500")}>
                {TAG_KEY[tag] ? t.tags[TAG_KEY[tag]] : tag}
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} dir="auto" placeholder={stars >= 4 ? t.wellDone : t.wentWrong} className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-[16px] sm:text-sm outline-none focus:border-foreground" />
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          <button onClick={send} disabled={busy} className="mt-3 h-11 px-6 rounded-full bg-foreground text-background text-sm inline-flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.sendRating}
          </button>
        </motion.div>
      )}
    </div>
  )
}
