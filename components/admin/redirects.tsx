"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CircleAlert, CircleCheck, CircleX, Loader2, Pencil, Search, Signpost, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { normalise, redirectIssues, traceRedirect, type Rule, type Trace } from "@/lib/cms/redirect-match"
import type { Redirect } from "@/lib/cms/redirect-rules"
import { checkLinksAction, deleteRedirectAction, listRedirectsAction, saveRedirectAction } from "@/app/(staff)/admin/seo-actions"
import { Switch } from "./fields"
import { Btn, Card, Notice, ago } from "./ui"

// Redirects: send old addresses to new ones (moved pages, renamed services, old campaign links).
// The form checks for loops and clashes as you type, with the same rules the server applies.

type Form = { source: string; destination: string; permanent: boolean; note: string; previous: string | null }
const EMPTY: Form = { source: "", destination: "", permanent: true, note: "", previous: null }
const inputCls = "h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 font-mono text-[13px] outline-none focus:border-foreground disabled:bg-zinc-50"
const isExternal = (s: string) => /^https?:\/\//i.test(s)

export function RedirectsManager({ canEdit, writable, knownPaths }: { canEdit: boolean; writable: boolean; knownPaths: string[] }) {
  const [rows, setRows] = useState<Redirect[] | null>(null)
  const [builtin, setBuiltin] = useState<Rule[]>([])
  const [error, setError] = useState("")
  const [form, setForm] = useState<Form>(EMPTY)
  const [issues, setIssues] = useState<string[]>([])
  const [saved, setSaved] = useState("")
  const [busy, setBusy] = useState("")
  const [q, setQ] = useState("")
  const [test, setTest] = useState("")
  const [trace, setTrace] = useState<Trace | null>(null)
  const [finalStatus, setFinalStatus] = useState<number | null | "checking">(null)
  const known = useMemo(() => new Set(knownPaths), [knownPaths])
  const editable = canEdit && writable

  const load = async () => {
    const r = await listRedirectsAction()
    if (r.ok) {
      setRows(r.data.rows)
      setBuiltin(r.data.builtin)
    } else setError(r.error)
  }
  useEffect(() => void load(), [])

  // Live checks on the form.
  const all = rows ?? []
  const others = all.filter((r) => r.source !== form.previous)
  const src = normalise(form.source)
  const dst = normalise(form.destination)
  const filled = Boolean(form.source.trim() && form.destination.trim())
  const problems = filled ? redirectIssues(form.source, form.destination, others) : []
  if (filled && form.previous !== src && others.some((r) => r.source === src)) problems.push(`There's already a redirect from ${src}. Edit that one instead.`)
  const onward = filled ? traceRedirect(dst, others) : null
  const warnings: string[] = []
  if (form.source.trim() && known.has(src)) warnings.push(`There's a live page at ${src}. Visitors will be sent away from it.`)
  if (onward && !problems.length) {
    if (!onward.loop && onward.hops.length) warnings.push(`${dst} redirects again, to ${onward.final}. Point straight there so visitors don't hop twice.`)
    else if (!onward.hops.length && !isExternal(dst) && !dst.includes("*") && !known.has(dst)) warnings.push(`The CMS doesn't know a page at ${dst}. Check the address before saving.`)
  }
  const change = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch })
    setSaved("")
  }

  const save = async () => {
    setBusy("save")
    setIssues([])
    setSaved("")
    const r = await saveRedirectAction({ source: form.source, destination: form.destination, permanent: form.permanent, note: form.note, previous: form.previous })
    setBusy("")
    if (!r.ok) return setIssues(r.issues ?? [r.error])
    setSaved(`Saved: ${r.data.source} → ${r.data.destination}. It starts working within a minute.`)
    setForm(EMPTY)
    await load()
  }

  const remove = async (r: Redirect) => {
    if (!confirm(`Delete the redirect from ${r.source}? Visitors to that address will see “page not found” again.`)) return
    setBusy(`del${r.source}`)
    const res = await deleteRedirectAction(r.source)
    setBusy("")
    if (!res.ok) return setError(res.error)
    if (form.previous === r.source) setForm(EMPTY)
    await load()
  }

  const edit = (r: Redirect) => {
    setForm({ source: r.source, destination: r.destination, permanent: r.permanent, note: r.note ?? "", previous: r.source })
    setIssues([])
    setSaved("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const runTest = async () => {
    if (!test.trim()) return
    const t = traceRedirect(test, all)
    setTrace(t)
    setFinalStatus(null)
    if (canEdit && !t.external && !t.loop) {
      setFinalStatus("checking")
      const r = await checkLinksAction([t.final])
      setFinalStatus(r.ok ? r.data[0].status : null)
    }
  }

  const rowFlags = (r: Redirect) => {
    const out: { tone: "warn" | "error"; text: string }[] = []
    if (known.has(r.source)) out.push({ tone: "warn", text: "A live page has this address; the redirect hides it." })
    const t = traceRedirect(r.destination, all.filter((x) => x.source !== r.source))
    if (t.loop) out.push({ tone: "error", text: "Loops back on itself." })
    else if (t.hops.length) out.push({ tone: "warn", text: `Continues to ${t.final}.` })
    else if (!t.external && !r.destination.includes("*") && !known.has(normalise(r.destination))) out.push({ tone: "warn", text: "No known page at the new address." })
    return out
  }
  const list = all.filter((r) => !q || `${r.source} ${r.destination} ${r.note ?? ""}`.toLowerCase().includes(q.toLowerCase().trim()))

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      {!canEdit && <Notice>You can look at redirects. Adding or changing them needs the SEO, Editor, Admin or Owner role.</Notice>}
      {canEdit && !writable && <Notice tone="warn">Saving redirects is switched off until Supabase is connected.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <p className="font-medium">{form.previous ? `Edit the redirect from ${form.previous}` : "Add a redirect"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">Old address</span>
              <input value={form.source} disabled={!editable} onChange={(e) => change({ source: e.target.value })} placeholder="/old-page" className={inputCls} dir="ltr" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">New address</span>
              <input value={form.destination} disabled={!editable} onChange={(e) => change({ destination: e.target.value })} placeholder="/new-page or https://…" className={inputCls} dir="ltr" />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-3">
            <Switch checked={form.permanent} disabled={!editable} onChange={(permanent) => change({ permanent })} />
            <span className="text-sm">
              <span className="font-medium">{form.permanent ? "Permanent (308)" : "Temporary (307)"}</span>
              <span className="block text-xs text-zinc-500">{form.permanent ? "The page has moved for good: Google moves its ranking to the new address." : "For a short while (a campaign, a page being rebuilt): Google keeps the old address."}</span>
            </span>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-[13px] font-medium">
              Note <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <input value={form.note} disabled={!editable} maxLength={200} onChange={(e) => change({ note: e.target.value })} placeholder="Why it exists, e.g. “Old Eid campaign link”" className={cn(inputCls, "font-sans text-sm")} />
          </label>

          {(problems.length > 0 || issues.length > 0) && (
            <ul className="mt-3 space-y-1 text-sm text-red-700">
              {[...new Set([...problems, ...issues])].map((i) => (
                <li key={i} className="flex gap-1.5">
                  <CircleX className="mt-0.5 h-4 w-4 shrink-0" /> {i}
                </li>
              ))}
            </ul>
          )}
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-brand-ink">
              {warnings.map((w) => (
                <li key={w} className="flex gap-1.5">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
          {onward && !problems.length && !onward.loop && onward.hops.length > 0 && editable && (
            <button type="button" onClick={() => change({ destination: onward.final })} className="mt-1 text-xs font-medium underline underline-offset-2">
              Use {onward.final} instead
            </button>
          )}
          {saved && <Notice tone="ok" className="mt-3">{saved}</Notice>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Btn variant="primary" busy={busy === "save"} disabled={!editable || !filled || problems.length > 0} onClick={save}>
              {form.previous ? "Save changes" : "Add redirect"}
            </Btn>
            {(form.previous || form.source || form.destination) && (
              <Btn onClick={() => (setForm(EMPTY), setIssues([]))} disabled={busy === "save"}>
                Cancel
              </Btn>
            )}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            End the old address with <code className="rounded bg-zinc-100 px-1">/*</code> to move a whole section, and put <code className="rounded bg-zinc-100 px-1">*</code> in the new one to keep the rest of the address: <code className="rounded bg-zinc-100 px-1">/tips/*</code> → <code className="rounded bg-zinc-100 px-1">/blog/*</code>. Urdu addresses (/ur/…) follow automatically. Changing a published item&apos;s address adds a redirect for you.
          </p>
        </Card>

        <Card className="p-5">
          <p className="flex items-center gap-2 font-medium">
            <Signpost className="h-4 w-4" /> Where does this address go?
          </p>
          <div className="mt-3 flex gap-2">
            <input value={test} onChange={(e) => (setTest(e.target.value), setTrace(null))} onKeyDown={(e) => e.key === "Enter" && void runTest()} placeholder="/any-address" className={inputCls} dir="ltr" />
            <Btn onClick={runTest} disabled={!test.trim() || !rows}>
              Test
            </Btn>
          </div>
          {trace && (
            <div className="mt-3 text-sm">
              {trace.hops.length === 0 ? (
                <p className="text-zinc-600">No redirect: visitors stay on {trace.final}.</p>
              ) : (
                <ol className="space-y-1.5">
                  {trace.hops.map((h, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-1.5" dir="ltr">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{h.from}</code>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{h.to}</code>
                      <span className="text-[11px] text-zinc-500">
                        {h.permanent ? "308" : "307"} · {h.builtin ? "built into the site" : `CMS (${h.source})`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-xs">
                {trace.loop ? (
                  <>
                    <CircleX className="h-4 w-4 text-red-600" /> <span className="text-red-700">This loops: browsers will show an error.</span>
                  </>
                ) : trace.external ? (
                  <>
                    <CircleCheck className="h-4 w-4 text-emerald-600" /> Ends on another website.
                  </>
                ) : finalStatus === "checking" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking {trace.final}…
                  </>
                ) : typeof finalStatus === "number" ? (
                  finalStatus >= 200 && finalStatus < 300 ? (
                    <>
                      <CircleCheck className="h-4 w-4 text-emerald-600" /> {trace.final} loads ({finalStatus}).
                    </>
                  ) : (
                    <>
                      <CircleX className="h-4 w-4 text-red-600" /> <span className="text-red-700">{finalStatus ? `${trace.final} answers ${finalStatus}.` : `${trace.final} doesn't load.`}</span>
                    </>
                  )
                ) : known.has(trace.final) ? (
                  <>
                    <CircleCheck className="h-4 w-4 text-emerald-600" /> Ends on a page the CMS knows.
                  </>
                ) : (
                  <>
                    <CircleAlert className="h-4 w-4 text-brand-ink" /> The CMS doesn&apos;t know a page at {trace.final}.
                  </>
                )}
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-zinc-500">Shows every hop, including the redirects built into the site&apos;s code.</p>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Redirects {rows && <span className="font-normal text-zinc-400">{rows.length}</span>}
          </h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search addresses and notes" className="h-9 w-full rounded-full border border-zinc-300 bg-white ps-9 pe-3 text-sm outline-none focus:border-foreground" />
          </div>
        </div>
        <Card className="overflow-hidden">
          {!rows && !error && <Loader2 className="m-4 h-5 w-5 animate-spin text-zinc-400" />}
          {rows && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">Old address</th>
                    <th className="px-3 py-2.5 text-start font-medium">New address</th>
                    <th className="px-3 py-2.5 text-start font-medium">Type</th>
                    <th className="px-3 py-2.5 text-start font-medium">Visits</th>
                    <th className="px-3 py-2.5 text-start font-medium">Added</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const flags = rowFlags(r)
                    return (
                      <tr key={r.source} className={cn("border-t border-zinc-100 align-top", form.previous === r.source && "bg-brand-soft/40")}>
                        <td className="px-4 py-2.5">
                          <code className="text-[13px]" dir="ltr">
                            {r.source}
                          </code>
                          {r.note && <p className="mt-0.5 text-xs text-zinc-500">{r.note}</p>}
                          {flags.map((f) => (
                            <p key={f.text} className={cn("mt-0.5 flex items-center gap-1 text-xs", f.tone === "error" ? "text-red-700" : "text-brand-ink")}>
                              <CircleAlert className="h-3 w-3" /> {f.text}
                            </p>
                          ))}
                        </td>
                        <td className="px-3 py-2.5">
                          <code className="break-all text-[13px]" dir="ltr">
                            {r.destination}
                          </code>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-500">{r.permanent ? "Permanent" : "Temporary"}</td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">{r.hits.toLocaleString()}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-500">
                          {ago(r.created_at)}
                          {r.created_by ? ` · ${r.created_by}` : ""}
                        </td>
                        <td className="px-3 py-2.5">
                          {editable && (
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => edit(r)} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-black/5 hover:text-foreground" aria-label={`Edit the redirect from ${r.source}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" disabled={busy === `del${r.source}`} onClick={() => remove(r)} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-600" aria-label={`Delete the redirect from ${r.source}`}>
                                {busy === `del${r.source}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows && !list.length && <p className="px-4 py-8 text-center text-sm text-zinc-500">{rows.length ? "No redirects match." : "No redirects yet. They appear here when you add one, or when a published page's address changes."}</p>}
        </Card>
      </section>

      {builtin.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Built into the site</h2>
          <p className="mb-3 text-xs text-zinc-500">These are set in the site&apos;s code and run before the ones above. A developer changes them.</p>
          <Card className="divide-y divide-zinc-100">
            {builtin.map((r) => (
              <div key={r.source} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm" dir="ltr">
                <code className="text-[13px]">{r.source}</code>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                <code className="text-[13px]">{r.destination}</code>
                <span className="ms-auto text-xs text-zinc-500">{r.permanent ? "Permanent" : "Temporary"}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
