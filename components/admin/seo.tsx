"use client"

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, CircleAlert, CircleCheck, CircleX, Copy, ExternalLink, Languages, Link2Off, Loader2, Monitor, Pencil, Play, Search, Smartphone, Square, Unlink } from "lucide-react"
import { cn } from "@/lib/utils"
import { localePath, type Locale } from "@/lib/i18n"
import type { Report, PageSpeed } from "@/lib/cms/seo/reports"
import type { SitePage } from "@/lib/cms/seo/pages"
import type { EntryCoverage } from "@/lib/cms/coverage"
import { auditAction, auditManyAction, checkLinksAction, pagespeedAction, seoOverviewAction } from "@/app/(staff)/admin/seo-actions"
import { coverageAction } from "@/app/(staff)/admin/translate-actions"
import { Btn, Card, Notice, ago } from "./ui"

// The SEO dashboard: every public page with its score and top problems, "Audit all", PageSpeed per
// page, and site-wide panels for duplicate titles, broken links, orphan pages and Urdu coverage.

type Overview = { pages: SitePage[]; reports: Report[]; appPaths: string[]; pagespeed: { available: boolean; host: string }; urduPublic: boolean }
type Run = { done: number; total: number; errors: number; running: boolean }
type LinkCheck = { status: number; location: string | null }

const PER_PAGE = 50
const BATCH = 12

/** A link as a site path: no locale, query, fragment or trailing slash. */
const normLink = (h: string) => {
  let s = h.split("#")[0].split("?")[0]
  s = s.replace(/^\/(en|ur)(?=\/|$)/, "") || "/"
  return s.length > 1 ? s.replace(/\/+$/, "") : s
}
const without = <T,>(o: Record<string, T>, k: string) => {
  const n = { ...o }
  delete n[k]
  return n
}
const band = (score: number) => (score >= 80 ? "good" : score >= 50 ? "ok" : "poor")

export function SeoDashboard({ canAudit, initialPath, initialLocale }: { canAudit: boolean; initialPath?: string; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? "en")
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  const [reports, setReports] = useState<Map<string, Report>>(new Map())
  const [group, setGroup] = useState("all")
  const [q, setQ] = useState(initialPath ?? "")
  const [show, setShow] = useState<"all" | "issues" | "unaudited">("all")
  const [sort, setSort] = useState<"site" | "score" | "oldest">("site")
  const [pageNo, setPageNo] = useState(0)
  const [open, setOpen] = useState<string | null>(initialPath ?? null)
  const [busy, setBusy] = useState<Record<string, string>>({})
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [run, setRun] = useState<Run | null>(null)
  const [links, setLinks] = useState<Record<string, LinkCheck>>({})
  const [checking, setChecking] = useState(false)
  const stop = useRef(false)

  useEffect(() => {
    let live = true
    setData(null)
    setError("")
    void seoOverviewAction(locale).then((r) => {
      if (!live) return
      if (!r.ok) return setError(r.error)
      setData(r.data)
      setReports(new Map(r.data.reports.map((x) => [`${x.locale}${x.path}`, x])))
    })
    return () => {
      live = false
    }
  }, [locale])

  const key = (p: string, l: Locale = locale) => `${l}${p}`
  const pages = useMemo(() => data?.pages ?? [], [data])
  const rep = (p: SitePage) => reports.get(key(p.path))
  const groups = useMemo(() => [...new Set(pages.map((p) => p.group))], [pages])

  const audited = pages.filter((p) => rep(p))
  const avg = audited.length ? Math.round(audited.reduce((n, p) => n + rep(p)!.score, 0) / audited.length) : null
  const counts = { good: 0, ok: 0, poor: 0 }
  for (const p of audited) counts[band(rep(p)!.score)]++
  const lastAudit = audited.reduce<string | null>((m, p) => (!m || rep(p)!.created_at > m ? rep(p)!.created_at : m), null)

  const filtered = pages.filter((p) => {
    const r = rep(p)
    if (group !== "all" && p.group !== group) return false
    if (q && !`${p.label} ${p.path} ${p.keyword}`.toLowerCase().includes(q.toLowerCase().trim())) return false
    if (show === "issues") return Boolean(r && r.score < 80)
    if (show === "unaudited") return !r
    return true
  })
  const sorted =
    sort === "site"
      ? filtered
      : [...filtered].sort((a, b) => {
          const ra = rep(a)
          const rb = rep(b)
          if (!ra || !rb) return ra ? -1 : rb ? 1 : 0
          return sort === "score" ? ra.score - rb.score : ra.created_at.localeCompare(rb.created_at)
        })
  const pageCount = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const shown = sorted.slice(pageNo * PER_PAGE, pageNo * PER_PAGE + PER_PAGE)
  const resetPage = () => setPageNo(0)

  // --- Actions ---------------------------------------------------------------

  const saveRow = (path: string, r: Report, l: Locale = locale) => setReports((m) => new Map(m).set(key(path, l), r))

  const auditOne = async (p: SitePage) => {
    setBusy((b) => ({ ...b, [p.path]: "audit" }))
    setRowError((e) => without(e, p.path))
    const r = await auditAction(p.path, locale, p.keyword)
    setBusy((b) => without(b, p.path))
    if (r.ok) saveRow(p.path, r.data)
    else setRowError((e) => ({ ...e, [p.path]: r.issues?.join(" ") || r.error }))
  }

  const speed = async (p: SitePage, strategy: "mobile" | "desktop") => {
    setBusy((b) => ({ ...b, [p.path]: "pagespeed" }))
    setRowError((e) => without(e, p.path))
    // PageSpeed results are kept with the page's English report, so make sure there is one.
    let report = reports.get(key(p.path, "en"))
    if (!report) {
      const a = await auditAction(p.path, "en", p.keyword)
      if (!a.ok) {
        setBusy((b) => without(b, p.path))
        return setRowError((e) => ({ ...e, [p.path]: a.issues?.join(" ") || a.error }))
      }
      report = a.data
    }
    const r = await pagespeedAction(p.path, strategy)
    setBusy((b) => without(b, p.path))
    if (r.ok) saveRow(p.path, { ...report, pagespeed: r.data }, "en")
    else setRowError((e) => ({ ...e, [p.path]: r.issues?.join(" ") || r.error }))
  }

  const auditAll = async (list: SitePage[]) => {
    stop.current = false
    setRun({ done: 0, total: list.length, errors: 0, running: true })
    for (let i = 0; i < list.length && !stop.current; i += BATCH) {
      const chunk = list.slice(i, i + BATCH)
      const r = await auditManyAction(
        chunk.map((p) => ({ path: p.path, keyword: p.keyword })),
        locale,
      )
      if (!r.ok) {
        setRowError((e) => ({ ...e, ...Object.fromEntries(chunk.map((p) => [p.path, r.error])) }))
        setRun((s) => s && { ...s, done: s.done + chunk.length, errors: s.errors + chunk.length })
        if (r.error.includes("permission") || r.error.includes("sign in")) break
        continue
      }
      setReports((m) => {
        const n = new Map(m)
        for (const x of r.data) if (x.report) n.set(key(x.path), x.report)
        return n
      })
      setRowError((e) => {
        const n = { ...e }
        for (const x of r.data) {
          if (x.error) n[x.path] = x.error
          else delete n[x.path]
        }
        return n
      })
      setRun((s) => s && { ...s, done: s.done + chunk.length, errors: s.errors + r.data.filter((x) => x.error).length })
    }
    setRun((s) => s && { ...s, running: false })
  }

  // --- Site-wide panels ----------------------------------------------------------

  const withReports = pages.map((p) => ({ p, r: rep(p) })).filter((x): x is { p: SitePage; r: Report } => Boolean(x.r))
  const duplicates = (pick: (r: Report) => string) => {
    const m = new Map<string, SitePage[]>()
    for (const { p, r } of withReports) {
      const t = pick(r).trim()
      if (t) m.set(t, [...(m.get(t) ?? []), p])
    }
    return [...m.entries()].filter(([, ps]) => ps.length > 1).sort((a, b) => b[1].length - a[1].length)
  }
  const dupTitles = duplicates((r) => r.analysis.stats.title)
  const dupDescriptions = duplicates((r) => r.analysis.stats.description)

  const known = new Set(["/", ...pages.map((p) => p.path), ...(data?.appPaths ?? [])])
  const linkedFrom = new Map<string, SitePage[]>()
  const linkedTo = new Set<string>()
  for (const { p, r } of withReports)
    for (const l of r.analysis.stats.internalLinks) {
      const n = normLink(l)
      linkedTo.add(n)
      if (!known.has(n) && !n.startsWith("/api/")) linkedFrom.set(n, [...(linkedFrom.get(n) ?? []), p])
    }
  const unknownLinks = [...linkedFrom.keys()].sort()
  const checkedBad = unknownLinks.filter((l) => links[l] && (links[l].status === 0 || links[l].status >= 400))
  const checkedRedirects = unknownLinks.filter((l) => links[l] && links[l].status >= 300 && links[l].status < 400)
  const unchecked = unknownLinks.filter((l) => !links[l])
  const checkLinks = async () => {
    setChecking(true)
    for (let i = 0; i < unchecked.length; i += 40) {
      const chunk = unchecked.slice(i, i + 40)
      const r = await checkLinksAction(chunk.map((l) => localePath(l, locale)))
      if (!r.ok) break
      setLinks((m) => ({ ...m, ...Object.fromEntries(r.data.map((x, j) => [chunk[j], { status: x.status, location: x.location ? normLink(x.location) : null }])) }))
    }
    setChecking(false)
  }

  const coverage = pages.length ? withReports.length / pages.length : 0
  const orphans = pages.filter((p) => p.path !== "/" && !p.noindex && !linkedTo.has(p.path))

  // --- Render ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      {!canAudit && <Notice>You can look at scores and reports. Running audits needs the SEO, Editor, Admin or Owner role.</Notice>}
      {locale === "ur" && data && !data.urduPublic && (
        <Notice tone="warn">The Urdu site is still hidden from search engines (Settings → Feature switches), so every Urdu page fails “Search engines may index it” until you switch it on.</Notice>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Average SEO score{locale === "ur" ? " (Urdu)" : ""}</p>
            <p className="font-serif text-4xl">{avg === null ? "—" : <span className={cn(avg >= 80 ? "text-emerald-700" : avg >= 50 ? "text-brand-ink" : "text-red-700")}>{avg}</span>}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {audited.length} of {pages.length} pages audited{lastAudit ? ` · last ${ago(lastAudit)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={locale} onChange={(l) => (setLocale(l), resetPage(), setLinks({}))} disabled={Boolean(run?.running)} options={[["en", "English"], ["ur", "اردو"]]} />
            {run?.running ? (
              <Btn onClick={() => (stop.current = true)}>
                <Square className="h-4 w-4" /> Stop
              </Btn>
            ) : (
              <Btn variant="primary" disabled={!canAudit || !data || filtered.length === 0} onClick={() => auditAll(filtered)}>
                <Play className="h-4 w-4" /> Audit {filtered.length === pages.length ? "all" : filtered.length} pages
              </Btn>
            )}
          </div>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-zinc-100">
          {pages.length > 0 && (
            <>
              <div className="bg-emerald-500" style={{ width: `${(counts.good / pages.length) * 100}%` }} />
              <div className="bg-brand" style={{ width: `${(counts.ok / pages.length) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(counts.poor / pages.length) * 100}%` }} />
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <Legend className="bg-emerald-500" label={`${counts.good} good (80+)`} />
          <Legend className="bg-brand" label={`${counts.ok} need work (50–79)`} />
          <Legend className="bg-red-500" label={`${counts.poor} poor (under 50)`} />
          <Legend className="bg-zinc-200" label={`${pages.length - audited.length} not audited`} />
        </div>
        {run && (
          <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm">
            <p className="flex items-center gap-2">
              {run.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4 text-emerald-600" />}
              {run.running ? `Auditing… ${run.done} of ${run.total}` : `Audited ${run.done - run.errors} of ${run.total} pages`}
              {run.errors > 0 && <span className="text-red-700">· {run.errors} couldn't be audited</span>}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          An audit loads the published page the way Google does and runs 16 checks: title and description, the focus keyword, headings, links, image alt text, amount of text and readability. Drafts don&apos;t count until they&apos;re published.
        </p>
      </Card>

      {!data && !error && <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}

      {data && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input value={q} onChange={(e) => (setQ(e.target.value), resetPage())} placeholder="Search pages, addresses or keywords" className="h-10 w-full rounded-full border border-zinc-300 bg-white ps-9 pe-3 text-sm outline-none focus:border-foreground" />
            </div>
            <select value={group} onChange={(e) => (setGroup(e.target.value), resetPage())} className="h-10 rounded-full border border-zinc-300 bg-white px-3 text-sm" aria-label="Section">
              <option value="all">All sections</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g} ({pages.filter((p) => p.group === g).length})
                </option>
              ))}
            </select>
            <select value={show} onChange={(e) => (setShow(e.target.value as typeof show), resetPage())} className="h-10 rounded-full border border-zinc-300 bg-white px-3 text-sm" aria-label="Show">
              <option value="all">Every page</option>
              <option value="issues">Scores under 80</option>
              <option value="unaudited">Not audited yet</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 rounded-full border border-zinc-300 bg-white px-3 text-sm" aria-label="Sort">
              <option value="site">Site order</option>
              <option value="score">Lowest score first</option>
              <option value="oldest">Oldest audit first</option>
            </select>
          </div>

          {/* Pages */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">Page</th>
                    <th className="px-3 py-2.5 text-start font-medium">Score</th>
                    <th className="px-3 py-2.5 text-start font-medium">Top problems</th>
                    {locale === "en" && <th className="px-3 py-2.5 text-start font-medium">PageSpeed</th>}
                    <th className="px-3 py-2.5 text-start font-medium">Audited</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const r = rep(p)
                    const issues = r ? r.analysis.checks.filter((c) => c.status !== "pass").sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === "fail" ? -1 : 1)) : []
                    const isOpen = open === p.path
                    return (
                      <Fragment key={p.path}>
                        <tr className={cn("border-t border-zinc-100 align-top", isOpen && "bg-zinc-50/70")}>
                          <td className="px-4 py-2.5">
                            <button type="button" onClick={() => setOpen(isOpen ? null : p.path)} className="flex items-start gap-1.5 text-start">
                              <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform", !isOpen && "-rotate-90")} />
                              <span className="min-w-0">
                                <span className="block font-medium">{p.label}</span>
                                <span className="block text-xs text-zinc-500" dir="ltr">
                                  {localePath(p.path, locale)} <span className="text-zinc-400">· {p.group}</span>
                                  {p.noindex && <span className="ms-1 rounded bg-zinc-100 px-1 text-[10px]">hidden from search</span>}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <ScoreBadge score={r?.score} />
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {rowError[p.path] ? (
                              <span className="text-red-700">{rowError[p.path]}</span>
                            ) : r ? (
                              issues.length ? (
                                <ul className="space-y-0.5">
                                  {issues.slice(0, 2).map((c) => (
                                    <li key={c.id} className="flex items-center gap-1.5">
                                      <StatusIcon status={c.status} />
                                      {c.label}
                                    </li>
                                  ))}
                                  {issues.length > 2 && <li className="text-zinc-400">+{issues.length - 2} more</li>}
                                </ul>
                              ) : (
                                <span className="text-emerald-700">Nothing to fix</span>
                              )
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          {locale === "en" && (
                            <td className="px-3 py-2.5 text-xs">
                              <SpeedCell ps={r?.pagespeed ?? null} />
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-500">{r ? ago(r.created_at) : "Never"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1">
                              {canAudit && (
                                <Btn size="sm" busy={busy[p.path] === "audit"} disabled={Boolean(busy[p.path]) || Boolean(run?.running)} onClick={() => auditOne(p)}>
                                  Audit
                                </Btn>
                              )}
                              {p.edit && (
                                <Link href={p.edit} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-black/5 hover:text-foreground" title="Edit this page's SEO" aria-label="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Link>
                              )}
                              <a href={localePath(p.path, locale)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-black/5 hover:text-foreground" title="Open the page" aria-label="Open the page">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-zinc-50/70">
                            <td colSpan={locale === "en" ? 6 : 5} className="px-4 pb-5 pt-1">
                              <Detail page={p} report={r} locale={locale} canAudit={canAudit} busy={busy[p.path]} pagespeedHost={data.pagespeed.available ? data.pagespeed.host : null} onSpeed={(s) => speed(p, s)} onAudit={() => auditOne(p)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!shown.length && <p className="px-4 py-8 text-center text-sm text-zinc-500">No pages match.</p>}
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-500">
                <span>
                  {pageNo * PER_PAGE + 1}–{Math.min(sorted.length, (pageNo + 1) * PER_PAGE)} of {sorted.length}
                </span>
                <span className="flex gap-1">
                  <Btn size="sm" disabled={pageNo === 0} onClick={() => setPageNo((n) => n - 1)}>
                    Previous
                  </Btn>
                  <Btn size="sm" disabled={pageNo >= pageCount - 1} onClick={() => setPageNo((n) => n + 1)}>
                    Next
                  </Btn>
                </span>
              </div>
            )}
          </Card>

          {/* Site-wide */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel icon={<Copy className="h-4 w-4" />} title="Duplicate titles and descriptions" empty={withReports.length === 0 ? "Audit some pages to compare their titles." : dupTitles.length + dupDescriptions.length === 0 ? "Every audited page has its own title and description." : null}>
              {[...dupTitles.map((d) => ["Title", ...d] as const), ...dupDescriptions.map((d) => ["Description", ...d] as const)].slice(0, 8).map(([kind, text, ps]) => (
                <li key={`${kind}${text}`} className="py-2">
                  <p className="text-xs text-zinc-500">
                    {kind} on {ps.length} pages
                  </p>
                  <p className="line-clamp-2 text-sm">{text}</p>
                  <PageLinks pages={ps} />
                </li>
              ))}
            </Panel>

            <Panel
              icon={<Link2Off className="h-4 w-4" />}
              title="Broken internal links"
              action={
                canAudit && unchecked.length > 0 ? (
                  <Btn size="sm" busy={checking} onClick={checkLinks}>
                    Check {unchecked.length} link{unchecked.length === 1 ? "" : "s"}
                  </Btn>
                ) : null
              }
              empty={withReports.length === 0 ? "Audit some pages to check their links." : unknownLinks.length === 0 ? "Every link in the audited pages goes to a page the site knows." : unchecked.length === unknownLinks.length ? `${unknownLinks.length} link${unknownLinks.length === 1 ? "" : "s"} point to addresses the dashboard doesn't know. Check them to see if they work.` : checkedBad.length + checkedRedirects.length === 0 ? "Every link checked works." : null}
            >
              {checkedBad.map((l) => (
                <li key={l} className="py-2">
                  <p className="flex items-center gap-1.5 text-sm">
                    <Unlink className="h-3.5 w-3.5 text-red-600" />
                    <span dir="ltr">{l}</span> <span className="text-xs text-red-700">{links[l].status ? `answers ${links[l].status}` : "doesn't load"}</span>
                  </p>
                  <PageLinks pages={linkedFrom.get(l) ?? []} prefix="Linked from" />
                </li>
              ))}
              {checkedRedirects.map((l) => (
                <li key={l} className="py-2">
                  <p className="text-sm">
                    <CircleAlert className="me-1.5 inline h-3.5 w-3.5 text-brand-ink" />
                    <span dir="ltr">{l}</span> <span className="text-xs text-zinc-500">redirects to {links[l].location ?? "another page"}: link there directly</span>
                  </p>
                  <PageLinks pages={linkedFrom.get(l) ?? []} prefix="Linked from" />
                </li>
              ))}
            </Panel>

            <Panel
              icon={<Unlink className="h-4 w-4" />}
              title="Orphan pages"
              empty={coverage < 0.9 ? `Audit all pages first: a page counts as an orphan when no other page links to it, so every page needs a report (${withReports.length} of ${pages.length} so far).` : orphans.length === 0 ? "Every page has at least one link from another page." : null}
            >
              <li className="pb-1 text-xs text-zinc-500">No other page links to these in its main content (menu and footer links don&apos;t count). Link to them from related pages so Google and visitors find them.</li>
              {orphans.slice(0, 30).map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {p.label} <span className="text-xs text-zinc-400" dir="ltr">{p.path}</span>
                  </span>
                  {p.edit && (
                    <Link href={p.edit} className="shrink-0 text-xs text-zinc-500 hover:text-foreground">
                      Edit
                    </Link>
                  )}
                </li>
              ))}
              {orphans.length > 30 && <li className="py-1.5 text-xs text-zinc-500">…and {orphans.length - 30} more.</li>}
            </Panel>

            <UrduPanel urduPublic={data.urduPublic} />
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Detail({ page, report, locale, canAudit, busy, pagespeedHost, onSpeed, onAudit }: { page: SitePage; report?: Report; locale: Locale; canAudit: boolean; busy?: string; pagespeedHost: string | null; onSpeed: (s: "mobile" | "desktop") => void; onAudit: () => void }) {
  if (!report)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
        Not audited yet.
        {canAudit && (
          <Btn size="sm" busy={busy === "audit"} onClick={onAudit}>
            Audit this page
          </Btn>
        )}
      </div>
    )
  const order = { fail: 0, warn: 1, pass: 2 }
  const checks = [...report.analysis.checks].sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight)
  const s = report.analysis.stats
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="mb-2 text-xs font-medium text-zinc-500">{checks.length} checks · audited {ago(report.created_at)}</p>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <StatusIcon status={c.status} className="mt-0.5" />
              <span className="min-w-0">
                <span className="font-medium">{c.label}</span> <span className="text-xs text-zinc-500">· {c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {page.edit && (
          <Link href={page.edit} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Fix it in the editor (SEO group)
          </Link>
        )}
        {page.group === "Area pages" && <p className="mt-2 text-xs text-zinc-500">Area pages take their title and description from the patterns in Settings → SEO settings.</p>}
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
          <p className="mb-2 text-xs font-medium text-zinc-500">What Google reads</p>
          <dl className="space-y-1.5 text-xs" dir={locale === "ur" ? "rtl" : "ltr"}>
            <Row label="Title" value={s.title || "—"} />
            <Row label="Description" value={s.description || "—"} />
            <Row label="Main heading" value={s.h1.join(" | ") || "—"} />
            <Row label="Focus keyword" value={page.keyword || "Not set"} />
          </dl>
          <p className="mt-3 text-xs text-zinc-500">
            {s.words.toLocaleString()} words · {s.internalLinks.length} internal links · {s.images ? `${s.images - s.imagesMissingAlt} of ${s.images} images with alt text` : "no images"}
            {s.readability !== null ? ` · reading ease ${s.readability}` : ""}
          </p>
        </div>
        {locale === "en" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-500">Google PageSpeed{report.pagespeed ? ` · ${report.pagespeed.strategy === "mobile" ? "phone" : "desktop"}, ${ago(report.pagespeed.at)}` : ""}</p>
              {canAudit && pagespeedHost && (
                <span className="flex gap-1">
                  <Btn size="sm" busy={busy === "pagespeed"} disabled={Boolean(busy)} onClick={() => onSpeed("mobile")} title="Test on a phone">
                    <Smartphone className="h-3.5 w-3.5" /> Phone
                  </Btn>
                  <Btn size="sm" disabled={Boolean(busy)} onClick={() => onSpeed("desktop")} title="Test on a desktop">
                    <Monitor className="h-3.5 w-3.5" /> Desktop
                  </Btn>
                </span>
              )}
            </div>
            {report.pagespeed ? (
              <>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      ["Speed", report.pagespeed.performance],
                      ["Access", report.pagespeed.accessibility],
                      ["Practices", report.pagespeed.bestPractices],
                      ["SEO", report.pagespeed.seo],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label}>
                      <ScoreBadge score={v ?? undefined} />
                      <p className="mt-1 text-[11px] text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Largest content shows in {report.pagespeed.lcp ?? "?"} · layout shift {report.pagespeed.cls ?? "?"} · blocking time {report.pagespeed.tbt ?? "?"}
                </p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">{pagespeedHost ? `Not run yet. It tests the public site (${pagespeedHost}) and takes up to a minute.` : "PageSpeed needs the public site address."}</p>
            )}
            {busy === "pagespeed" && <p className="mt-2 text-xs text-zinc-500">Google is loading the page… this takes up to a minute.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function UrduPanel({ urduPublic }: { urduPublic: boolean }) {
  const [rows, setRows] = useState<EntryCoverage[] | null>(null)
  useEffect(() => {
    void coverageAction().then((r) => r.ok && setRows(r.data))
  }, [])
  const total = rows?.reduce((n, r) => n + r.total, 0) ?? 0
  const done = rows?.reduce((n, r) => n + r.done, 0) ?? 0
  const ai = rows?.reduce((n, r) => n + r.ai, 0) ?? 0
  return (
    <Panel icon={<Languages className="h-4 w-4" />} title="Urdu site" empty={null}>
      <li className="py-1 text-sm">
        {rows ? (
          <>
            <p className="font-serif text-3xl">{total ? Math.round((done / total) * 100) : 100}% in Urdu</p>
            <p className="text-xs text-zinc-500">
              {done.toLocaleString()} of {total.toLocaleString()} texts{ai ? ` · ${ai.toLocaleString()} by AI, not reviewed yet` : ""}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
            </div>
          </>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        )}
        <p className="mt-3 text-xs text-zinc-500">{urduPublic ? "The Urdu site is public: Google can index /ur pages, and every page lists its Urdu version." : "The Urdu site is hidden from search engines until you switch it on in Settings → Feature switches."}</p>
        <Link href="/admin/translate" className="mt-2 inline-block text-xs font-medium hover:underline">
          Open Urdu translation
        </Link>
      </li>
    </Panel>
  )
}

function Panel({ icon, title, action, empty, children }: { icon: ReactNode; title: string; action?: ReactNode; empty: string | null; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          {icon} {title}
        </p>
        {action}
      </div>
      {empty ? <p className="text-sm text-zinc-500">{empty}</p> : <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto">{children}</ul>}
    </Card>
  )
}

function PageLinks({ pages, prefix }: { pages: SitePage[]; prefix?: string }) {
  return (
    <p className="mt-0.5 text-xs text-zinc-500">
      {prefix ? `${prefix}: ` : ""}
      {pages.slice(0, 6).map((p, i) => (
        <Fragment key={p.path}>
          {i > 0 && ", "}
          {p.edit ? (
            <Link href={p.edit} className="underline-offset-2 hover:text-foreground hover:underline">
              {p.label}
            </Link>
          ) : (
            p.label
          )}
        </Fragment>
      ))}
      {pages.length > 6 && ` and ${pages.length - 6} more`}
    </p>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  )
}

function SpeedCell({ ps }: { ps: PageSpeed | null }) {
  if (!ps) return <span className="text-zinc-400">—</span>
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {ps.strategy === "mobile" ? <Smartphone className="h-3.5 w-3.5 text-zinc-400" /> : <Monitor className="h-3.5 w-3.5 text-zinc-400" />}
      <ScoreBadge score={ps.performance ?? undefined} small />
      {ps.lcp && <span className="text-zinc-500">{ps.lcp}</span>}
    </span>
  )
}

export function ScoreBadge({ score, small }: { score?: number; small?: boolean }) {
  if (score == null) return <span className="text-xs text-zinc-400">—</span>
  return (
    <span className={cn("inline-grid place-items-center rounded-full font-semibold tabular-nums", small ? "h-6 min-w-8 px-1.5 text-[11px]" : "h-8 min-w-11 px-2 text-sm", band(score) === "good" ? "bg-emerald-50 text-emerald-800" : band(score) === "ok" ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-800")}>
      {score}
    </span>
  )
}

function StatusIcon({ status, className }: { status: "pass" | "warn" | "fail"; className?: string }) {
  return status === "pass" ? <CircleCheck className={cn("h-3.5 w-3.5 shrink-0 text-emerald-600", className)} /> : status === "warn" ? <CircleAlert className={cn("h-3.5 w-3.5 shrink-0 text-brand-ink", className)} /> : <CircleX className={cn("h-3.5 w-3.5 shrink-0 text-red-600", className)} />
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  )
}

function Segmented<T extends string>({ value, onChange, options, disabled }: { value: T; onChange: (v: T) => void; options: [T, string][]; disabled?: boolean }) {
  return (
    <div className={cn("inline-flex rounded-full border border-zinc-300 bg-white p-0.5 text-sm", disabled && "pointer-events-none opacity-50")}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("rounded-full px-3 py-1.5 transition-colors", value === v ? "bg-foreground text-background" : "text-zinc-600 hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  )
}
