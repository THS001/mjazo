"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { CircleAlert, CircleCheck, CircleX, Gauge, ImageIcon, Lock, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GroupField, Localized, MediaRef } from "@/lib/cms/fields"
import { hasKeyword } from "@/lib/cms/seo/score"
import { seoPanelAction, seoSuggestAction } from "@/app/(staff)/admin/seo-actions"
import type { FormCtx } from "./fields"
import { Btn, ago } from "./ui"

// The SEO group in every editor: how the page will look in Google and when shared on WhatsApp,
// live checks as you type (the same thresholds as the SEO score), AI suggestions, and the page's
// latest audit. Empty fields fall back to what the live page uses today, so the preview is honest.

type Lang = "en" | "ur"
type Panel = { live: { title: string; description: string; image: string | null } | null; template: string; host: string; report: { score: number; at: string; fails: number; warns: number; top: string[] } | null }
type Status = "pass" | "warn" | "fail"

const range = (n: number, lo: number, hi: number, loWarn: number, hiWarn: number): Status => (n >= lo && n <= hi ? "pass" : n >= loWarn && n <= hiWarn ? "warn" : "fail")
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
/** Shortens an AI suggestion to a field's limit at a word boundary. */
const fit = (s: string, max: number) => {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const sp = cut.lastIndexOf(" ")
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:–-]+$/, "")
}

export function SeoGroup({ field, value, onChange, ctx, children }: { field: GroupField; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; ctx: FormCtx; children: ReactNode }) {
  const [langPick, setLang] = useState<Lang>("en")
  const [view, setView] = useState<"google" | "social">("google")
  const [panels, setPanels] = useState<Partial<Record<Lang, Panel | "error">>>({})
  const [suggestion, setSuggestion] = useState<{ title: string; description: string; keyword: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const asked = useRef(new Set<string>())
  const lang: Lang = ctx.showUr ? langPick : "en"
  const path = ctx.path ?? null
  const canChange = !ctx.readOnly && ctx.canSeo !== false

  useEffect(() => {
    if (!path || asked.current.has(`${lang}${path}`)) return
    asked.current.add(`${lang}${path}`)
    void seoPanelAction(path, lang).then((r) => setPanels((p) => ({ ...p, [lang]: r.ok ? r.data : "error" })))
  }, [path, lang])

  const panel = panels[lang]
  const loaded = panel && panel !== "error" ? panel : null
  const own = (k: string) => {
    const v = value[k] as Localized | undefined
    return ((lang === "ur" ? v?.ur : v?.en) ?? "").trim()
  }
  const ownTitle = own("title")
  const ownDescription = own("description")
  const keyword = own("keyword")
  const template = loaded?.template ?? (lang === "ur" ? "%s · مجازو" : "%s · Mjazo")
  const title = ownTitle ? (path === "/" ? ownTitle : template.includes("%s") ? template.replace("%s", ownTitle) : ownTitle) : (loaded?.live?.title ?? "")
  const description = ownDescription || loaded?.live?.description || ""
  const ownImage = (value.image as MediaRef | null | undefined)?.url || null
  const image = ownImage || loaded?.live?.image || null
  const noindex = Boolean(value.noindex)
  const host = loaded?.host ?? "mjazo.pk"
  const crumbs = [host, ...(lang === "ur" ? ["ur"] : []), ...(path ?? "/").split("/").filter(Boolean)].join(" › ")
  const rtl = lang === "ur"

  const checks: { label: string; status: Status; detail: string }[] = [
    { label: "Search title", status: title ? range(title.length, 30, 65, 20, 75) : "fail", detail: title ? `${title.length} characters with the ending (aim for 30–65)` : "No title" },
    { label: "Search description", status: description ? range(description.length, 70, 160, 50, 200) : "fail", detail: description ? `${description.length} characters (aim for 70–160)` : "No description" },
    { label: "Focus keyword", status: keyword ? "pass" : "warn", detail: keyword ? `“${keyword}”` : lang === "ur" ? "No Urdu keyword yet" : "Add one to check the title and description" },
    ...(keyword
      ? [
          { label: "Keyword in title", status: (hasKeyword(title, keyword) ? "pass" : "fail") as Status, detail: hasKeyword(title, keyword) ? "Found" : "Put the keyword in the search title" },
          { label: "Keyword in description", status: (hasKeyword(description, keyword) ? "pass" : "warn") as Status, detail: hasKeyword(description, keyword) ? "Found" : "Mention it in the description" },
        ]
      : []),
    ownImage && /\.(webp|avif)(\?|$)/i.test(ownImage)
      ? { label: "Share image", status: "warn", detail: "WebP and AVIF don't show on every app: use a JPG or PNG" }
      : { label: "Share image", status: image ? "pass" : "warn", detail: image ? (ownImage ? "Set here" : "The page's built-in image") : "None: shared links show no picture" },
    { label: "Search engines", status: noindex ? "fail" : "pass", detail: noindex ? "Hidden from search engines" : "May show this page" },
  ]

  const suggest = async () => {
    if (!ctx.entryType || !path) return
    setBusy(true)
    setError("")
    const r = await seoSuggestAction(ctx.entryType, ctx.root ?? {}, path)
    setBusy(false)
    if (r.ok) setSuggestion(r.data)
    else setError(r.issues?.join(" ") || r.error)
  }
  const use = (keys: ("title" | "description" | "keyword")[]) => {
    if (!suggestion) return
    const next = { ...value }
    for (const k of keys) {
      const max = (field.fields[k] as { max?: number } | undefined)?.max
      const cur = (value[k] as Localized | undefined) ?? { en: "" }
      next[k] = { ...cur, en: max ? fit(suggestion[k], max) : suggestion[k] }
    }
    onChange(next)
  }

  return (
    <fieldset className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
      <legend className="px-1 text-[13px] font-semibold">{field.label}</legend>
      {field.help && <p className="mb-3 text-xs text-zinc-500">{field.help}</p>}
      {ctx.canSeo === false && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500">
          <Lock className="h-3 w-3" /> Editors, Admins and the SEO role can change these.
        </p>
      )}

      {path && (
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented value={view} onChange={setView} options={[["google", "Google"], ["social", "WhatsApp & social"]]} />
            {ctx.showUr && <Segmented value={lang} onChange={setLang} options={[["en", "English"], ["ur", "اردو"]]} />}
          </div>

          {view === "google" ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4" dir={rtl ? "rtl" : "ltr"}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 bg-[#F4F4F2] text-[11px] font-semibold">M</span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[13px] text-[#202124]">Mjazo</span>
                  <span className="block truncate text-[12px] text-[#4d5156]" dir="ltr">
                    {crumbs}
                  </span>
                </span>
              </div>
              <p className={cn("mt-2 text-[19px] leading-snug text-[#1a0dab]", rtl && "font-urdu leading-loose")}>{title ? clip(title, 62) : <span className="text-zinc-400">No title yet</span>}</p>
              <p className={cn("mt-1 text-[13.5px] leading-relaxed text-[#4d5156]", rtl && "font-urdu leading-loose")}>{description ? clip(description, 158) : <span className="text-zinc-400">No description: Google picks some text from the page.</span>}</p>
            </div>
          ) : (
            <div className="max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-[#f0f2f5]" dir={rtl ? "rtl" : "ltr"}>
              <div className="aspect-[1.91/1] bg-zinc-200">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-zinc-400">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5 px-3 py-2.5">
                <p className={cn("line-clamp-2 text-[14px] font-semibold text-[#111b21]", rtl && "font-urdu leading-loose")}>{title || "No title yet"}</p>
                <p className={cn("line-clamp-2 text-[12.5px] text-[#667781]", rtl && "font-urdu leading-loose")}>{description}</p>
                <p className="text-[11px] lowercase text-[#667781]" dir="ltr">
                  {host}
                </p>
              </div>
            </div>
          )}

          <p className="text-[11px] text-zinc-500">
            {panel === undefined
              ? "Loading the live page…"
              : panel === "error"
                ? "Couldn't load the live page, so empty fields show nothing here."
                : !loaded?.live
                  ? "This page isn't live yet: empty fields will use the built-in title and description."
                  : ownTitle && ownDescription
                    ? "Using the search title and description below."
                    : "Empty fields show what the live page uses today (the built-in text). Publish to see changes in Google, usually within days."}
          </p>

          <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-xs">
                {c.status === "pass" ? <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" /> : c.status === "warn" ? <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-brand-ink" /> : <CircleX className="mt-px h-3.5 w-3.5 shrink-0 text-red-600" />}
                <span className="min-w-0">
                  <span className="font-medium">{c.label}</span> <span className="text-zinc-500">· {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            {canChange && lang === "en" && (
              <Btn size="sm" busy={busy} onClick={suggest} type="button">
                <Sparkles className="h-3.5 w-3.5" /> Suggest with AI
              </Btn>
            )}
            <Link href={`/admin/seo?path=${encodeURIComponent(path)}&locale=${lang}`} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-zinc-600 hover:bg-black/5 hover:text-foreground">
              <Gauge className="h-3.5 w-3.5" />
              {loaded?.report ? (
                <>
                  SEO score <ScoreText score={loaded.report.score} /> · audited {ago(loaded.report.at)}
                  {loaded.report.fails + loaded.report.warns > 0 && ` · ${loaded.report.fails + loaded.report.warns} to fix`}
                </>
              ) : (
                "Not audited yet: open the SEO dashboard"
              )}
            </Link>
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}

          {suggestion && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-violet-900">
                  <Sparkles className="h-3.5 w-3.5" /> AI suggestion (English). Check it reads right before you publish.
                </p>
                <button type="button" onClick={() => setSuggestion(null)} className="grid h-6 w-6 place-items-center rounded-full text-violet-900 hover:bg-violet-100" aria-label="Close suggestion">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <dl className="space-y-2">
                {(["title", "description", "keyword"] as const).map((k) => (
                  <div key={k} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <dt className="text-[11px] text-violet-900/70">{k === "title" ? "Search title" : k === "description" ? "Search description" : "Focus keyword"}</dt>
                      <dd>{suggestion[k]}</dd>
                    </div>
                    <Btn size="sm" type="button" onClick={() => use([k])}>
                      Use
                    </Btn>
                  </div>
                ))}
              </dl>
              <Btn size="sm" variant="primary" type="button" className="mt-3" onClick={() => (use(["title", "description", "keyword"]), setSuggestion(null))}>
                Use all three
              </Btn>
            </div>
          )}
        </div>
      )}

      {children}
    </fieldset>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-full border border-zinc-300 bg-white p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("rounded-full px-3 py-1 transition-colors", value === v ? "bg-foreground text-background" : "text-zinc-600 hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function ScoreText({ score }: { score: number }) {
  return <b className={cn("font-semibold tabular-nums", score >= 80 ? "text-emerald-700" : score >= 50 ? "text-brand-ink" : "text-red-700")}>{score}</b>
}
