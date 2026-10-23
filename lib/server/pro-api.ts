import "server-only"
import { aiEnabled } from "@/lib/ai/anthropic"
import { readReceipt } from "@/lib/ai/staff-agents"
import { formatPKR } from "@/lib/catalog"
import { getCatalog } from "@/lib/cms/read"
import { requireCore } from "@/lib/core/db"
import { emit } from "@/lib/core/events"
import { earnedSince, proBalances, proShare, proStatement } from "@/lib/core/ledger"
import { proPayouts, proRatings } from "@/lib/core/pro-history"
import { setProProfile, type ProProfilePatch } from "@/lib/core/pros"
import { saveLocation } from "@/lib/core/tracking"
import { jobMinutes, windowIndex } from "@/lib/ops/logic"
import { isVerified, type Job, type PaymentRecord, type Pro } from "@/lib/ops/types"
import { karachiNow, WINDOW_LABELS } from "@/lib/time"
import { audit } from "./audit"
import { get, put } from "./docs"
import { OpsError, addJobEvent, answerOffer, getJob, listOffers, nowIso, safetySweep, syncJobs, updateJob } from "./ops"
import { newId, notifyOps } from "./store"

// What the pro app shows and does (/api/v1/pro, used by /pro on the web and by the phone app).
// Every function takes the signed-in pro (lib/server/pro-auth.ts) and only ever touches her own
// visits, offers and money. Before she accepts an offer she sees where and what, but not who:
// the customer's name, phone and address come with the visit once it's hers.

type Cat = Awaited<ReturnType<typeof getCatalog>>

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const byRoute = (a: Job, b: Job) => a.date.localeCompare(b.date) || (a.routeOrder ?? 99) - (b.routeOrder ?? 99) || windowIndex(a.window) - windowIndex(b.window)
const areaName = (cat: Cat, slug: string) => cat.getArea(slug)?.name ?? slug

/** What she earns for a visit: her share of the full price (Mjazo funds any discount). */
export const visitEarning = (j: Job, pro: Pro) => proShare(j.items.reduce((s, i) => s + i.unitPrice * i.qty, 0), pro.commissionRate ?? 0.25)

const services = (j: Job) => j.items.map((i) => ({ name: i.name, options: i.options, addOns: i.addOns, qty: i.qty }))

// ---------------------------------------------------------------------------
// Her visits
// ---------------------------------------------------------------------------

/** One of her visits, everything she needs on the day. */
function visitView(j: Job & { safety: { level: string; message: string } }, pro: Pro, cat: Cat, history: Job[], photos: string[]) {
  return {
    id: j.id,
    date: j.date,
    window: j.window,
    eta: j.eta ?? null,
    status: j.status,
    area: areaName(cat, j.area),
    subArea: j.subArea ?? null,
    address: j.address,
    landmark: j.landmark ?? null,
    customer: j.customer,
    items: j.items,
    total: j.total,
    // Paid from the customer's Mjazo credit and their prepaid pack; she collects the rest (due).
    credit: j.credit ?? 0,
    pack: j.pack ? { name: j.pack.name, paid: j.pack.paid } : null,
    due: j.total - (j.credit ?? 0) - (j.pack?.paid ?? 0),
    askedForYou: j.preferredProId === pro.id,
    earn: visitEarning(j, pro),
    payment: j.payment,
    notes: j.notes ?? null,
    minutes: jobMinutes(j, cat),
    checkedInAt: j.events.filter((e) => e.type === "checked_in").slice(-1)[0]?.at ?? null,
    brief: j.brief ?? null,
    photos,
    event: j.event ?? null,
    safety: j.safety,
    paid: j.paymentRecord ? { status: j.paymentRecord.status, amount: j.paymentRecord.amount, method: j.paymentRecord.method } : null,
    // What she or other pros noted at this customer's earlier visits.
    lastNotes: history
      .filter((x) => x.customer.phone === j.customer.phone && x.id !== j.id && x.visitNotes?.length)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((x) => x.visitNotes!)
      .slice(0, 3),
  }
}
export type VisitView = ReturnType<typeof visitView>

/** Her visits from today for `days` days (today's with safety prompts), grouped by day. */
export async function proSchedule(pro: Pro, days = 7) {
  const span = Math.min(Math.max(Math.round(days) || 7, 1), 14)
  const cat = await getCatalog()
  const today = karachiNow().date
  const last = addDays(today, span - 1)
  const jobs = await syncJobs()
  const mine = jobs.filter((j) => j.proId === pro.id && j.date >= today && j.date <= last && j.status !== "cancelled").sort(byRoute)
  const swept = await safetySweep(mine)
  // Brief photos sent by the customer, for today's open visits (deleted when the visit ends).
  const photos = new Map<string, string[]>()
  await Promise.all(
    swept
      .filter((j) => j.date === today && j.brief?.hasPhotos && j.status !== "completed")
      .map(async (j) => {
        const a = await get<{ id: string; photos: string[] }>("attachments", j.id)
        if (a) photos.set(j.id, a.photos)
      }),
  )
  const views = swept.map((j) => visitView(j, pro, cat, jobs, photos.get(j.id) ?? []))
  const db = await requireCore()
  const weekAgo = addDays(today, -6)
  const [week, open] = await Promise.all([earnedSince(db, pro.id, `${weekAgo}T00:00:00+05:00`), listOffers({ proId: pro.id, status: "pending" })])
  return {
    today,
    days: Array.from({ length: span }, (_, i) => addDays(today, i)).map((date) => ({ date, visits: views.filter((v) => v.date === date) })),
    week,
    openOffers: open.length,
    ai: aiEnabled(),
  }
}

const geoOf = (b: { lat?: number; lng?: number }) => (b.lat !== undefined && b.lng !== undefined ? { lat: b.lat, lng: b.lng } : {})

export type VisitAction =
  | { action: "en_route" | "check_in" | "safe" | "check_out"; lat?: number; lng?: number }
  | { action: "note"; note: string }
  | { action: "complete"; lat?: number; lng?: number; payment: { method: "cash" | "jazzcash" | "easypaisa" | "raast"; amount: number; screenshot?: string } }

/** On my way, check in, I'm safe, check out, a note for next time, or finish with the payment. */
export async function proVisitAction(pro: Pro, jobId: string, b: VisitAction): Promise<{ job: Job; message?: string }> {
  const proId = pro.id
  if (b.action === "note") {
    const job = await updateJob(jobId, (j) => {
      if (j.proId !== proId) throw new OpsError("This visit isn't yours")
      j.visitNotes = [...(j.visitNotes ?? []), `${j.date}: ${b.note.trim()}`]
    })
    return { job }
  }
  const g = geoOf(b)
  if (b.action !== "complete") {
    const type = b.action === "check_in" ? "checked_in" : b.action === "check_out" ? "checked_out" : b.action
    return { job: await addJobEvent(jobId, type, "pro", g, { proId }) }
  }
  // Finish: check out if she hasn't, record the payment (AI reads a digital receipt), mark it done.
  const p = b.payment
  if (p.method !== "cash" && !p.screenshot) throw new OpsError("Add a screenshot of the payment")
  let job = await getJob(jobId)
  if (!job || job.proId !== proId) throw new OpsError("This visit isn't yours")
  if (job.status === "checked_in") job = await addJobEvent(jobId, "checked_out", "pro", g, { proId })
  if (job.status !== "checked_out") throw new OpsError("Check in first, then finish the visit")
  const due = job.total - (job.credit ?? 0) - (job.pack?.paid ?? 0)
  let record: PaymentRecord = { amount: p.amount, method: p.method, at: nowIso(), status: p.method === "cash" ? "cash" : "pending" }
  let message = p.method === "cash" ? `Cash ${formatPKR(p.amount)} recorded.` : "Payment saved. Ops will check it."
  if (p.method !== "cash") {
    record.screenshot = p.screenshot
    if (aiEnabled() && p.screenshot) {
      try {
        const r = await readReceipt(p.screenshot.split(",")[1] ?? p.screenshot, due)
        record = { ...record, status: r.status, ocr: r.ocr }
        message =
          r.status === "matched"
            ? `Payment checked: ${formatPKR(r.ocr.amount ?? p.amount)} matches.`
            : r.status === "mismatch"
              ? `The screenshot shows ${formatPKR(r.ocr.amount ?? 0)}, but the visit's amount to collect is ${formatPKR(due)}. Ops will check.`
              : "We couldn't read the screenshot. Ops will check it."
      } catch (e) {
        console.error("[pro] receipt read failed", e)
      }
    }
  }
  if (record.status === "cash" && p.amount !== due) {
    message = `Cash ${formatPKR(p.amount)} recorded (${formatPKR(due)} was due). Ops will check.`
    record.status = "mismatch"
  }
  await updateJob(jobId, (j) => {
    j.paymentRecord = record
    j.events.push({ type: "payment", at: nowIso(), by: "pro", actor: proId, note: `${p.method} ${p.amount} (${record.status})` })
  })
  return { job: await addJobEvent(jobId, "completed", "pro", {}, { proId }), message }
}

/** Her latest location while she's on the way (false once the visit has moved on: the app stops sending). */
export async function proVisitLocation(pro: Pro, jobId: string, p: { lat: number; lng: number; accuracy?: number }) {
  return saveLocation(await requireCore(), { bookingId: jobId, proId: pro.id, lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? null })
}

/** SOS: on a visit it goes on the visit (and ops are told at once); between visits it's logged and ops are told. */
export async function proSos(pro: Pro, b: { jobId?: string; lat?: number; lng?: number }) {
  const g = geoOf(b)
  await audit(`pro:${pro.id}`, "SOS raised", b.jobId ?? pro.id)
  if (b.jobId) {
    const job = await getJob(b.jobId)
    if (job?.proId === pro.id && !["completed", "cancelled", "new", "no_show"].includes(job.status)) {
      await addJobEvent(b.jobId, "sos", "pro", g, { proId: pro.id })
      return { ok: true }
    }
  }
  await put("sos", { id: `S-${newId().slice(3)}`, proId: pro.id, at: nowIso(), ...g })
  await notifyOps(`[Mjazo SAFETY] SOS from ${pro.name}`, `${pro.name} (${pro.phone}) pressed SOS.\nLocation: ${g.lat ?? "?"}, ${g.lng ?? "?"}\nCall her now.`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

/** Her offers from the last week, open ones first. Before she accepts: where and what, not who. */
export async function proOffers(pro: Pro) {
  const cat = await getCatalog()
  const list = await listOffers({ proId: pro.id, since: new Date(Date.now() - 7 * 86400000).toISOString(), limit: 30 })
  const jobs = await Promise.all(list.map((o) => getJob(o.bookingId)))
  const offers = list
    .map((o, i) => {
      const j = jobs[i]
      return {
        id: o.id,
        status: o.status,
        offeredAt: o.offeredAt,
        expiresAt: o.expiresAt,
        respondedAt: o.respondedAt,
        reason: o.reason,
        visit: j && { id: j.id, date: j.date, window: j.window, area: areaName(cat, j.area), subArea: j.subArea ?? null, services: services(j), minutes: jobMinutes(j, cat), earn: visitEarning(j, pro), payment: j.payment, hasBrief: Boolean(j.brief), askedForYou: j.preferredProId === pro.id },
      }
    })
    .filter((o) => o.visit)
  return { offers: [...offers.filter((o) => o.status === "pending"), ...offers.filter((o) => o.status !== "pending")] }
}

/** She accepts or declines an offer. */
export async function proAnswerOffer(pro: Pro, offerId: string, accept: boolean, reason?: string) {
  const o = await answerOffer({ offerId, proId: pro.id, accept, reason })
  if (o.status === "expired") throw new OpsError("This offer has expired")
  if (o.status === "withdrawn") throw new OpsError("Ops have already given this visit to someone else")
  return { offer: { id: o.id, status: o.status } }
}

// ---------------------------------------------------------------------------
// Money, ratings, profile, availability
// ---------------------------------------------------------------------------

/** What she's owed, the cash she holds, her recent earnings, her statement and her payouts. */
export async function proEarnings(pro: Pro) {
  const db = await requireCore()
  const today = karachiNow().date
  const [bal, week, month, statement, payouts] = await Promise.all([
    proBalances(db, pro.id),
    earnedSince(db, pro.id, `${addDays(today, -6)}T00:00:00+05:00`),
    earnedSince(db, pro.id, `${addDays(today, -29)}T00:00:00+05:00`),
    proStatement(db, pro.id, 60),
    proPayouts(db, pro.id),
  ])
  // owed > cash: Mjazo pays her the difference; cash > owed: she hands the difference in.
  return { balances: { owed: bal.payable, cashHeld: bal.cashHeld, net: bal.payable - bal.cashHeld }, week, month, statement, payouts }
}

export async function proRatingSummary(pro: Pro) {
  return proRatings(await requireCore(), pro.id)
}

/** Her profile as the app shows it. */
export async function proProfile(pro: Pro) {
  const cat = await getCatalog()
  const r = await proRatings(await requireCore(), pro.id, 0)
  return {
    id: pro.id,
    name: pro.name,
    phone: pro.phone,
    email: pro.email ?? null,
    area: areaName(cat, pro.area),
    zones: (pro.zones ?? []).map((z) => areaName(cat, z)),
    skills: pro.skills.map((s) => cat.getCategory(s)?.name ?? s),
    verified: isVerified(pro),
    dailyCap: pro.dailyCap ?? 5,
    rating: { average: r.average, count: r.count },
  }
}

/** Her weekly windows and days off, the windows to pick from, and the days she already has visits. */
export async function proAvailability(pro: Pro) {
  const today = karachiNow().date
  const jobs = await syncJobs()
  const busy = [...new Set(jobs.filter((j) => j.proId === pro.id && j.date >= today && !["cancelled", "no_show", "completed"].includes(j.status)).map((j) => j.date))].sort()
  return { availability: pro.availability ?? null, timeOff: pro.timeOff ?? [], windows: WINDOW_LABELS, busyDays: busy, dailyCap: pro.dailyCap ?? 5 }
}

/**
 * She changes her weekly windows or days off. A day off on a day she already has visits is refused
 * (ops move those first); visits already given to her stay hers when she changes her windows.
 */
export async function setProAvailability(pro: Pro, patch: Pick<ProProfilePatch, "availability" | "timeOff">) {
  const today = karachiNow().date
  const add = patch.timeOff?.add ?? []
  if (add.some((d) => d < today)) throw new OpsError("Pick today or a later day")
  const { busyDays } = await proAvailability(pro)
  const clash = add.filter((d) => busyDays.includes(d))
  if (clash.length) {
    const when = clash.map((d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })).join(", ")
    throw new OpsError(`You have visits on ${when}. Ask ops to move them first.`)
  }
  const db = await requireCore()
  const cat = await getCatalog()
  await setProProfile(db, pro.id, { availability: patch.availability, timeOff: patch.timeOff }, cat.areas.map((a) => a.slug))
  const what = [patch.availability !== undefined && "weekly windows", add.length && `days off +${add.join(", ")}`, patch.timeOff?.remove?.length && `days off −${patch.timeOff.remove.join(", ")}`].filter(Boolean).join("; ")
  await emit(db, "pro.availability_changed", { proId: pro.id }, { availability: patch.availability !== undefined, timeOff: patch.timeOff ?? null })
  await audit(`pro:${pro.id}`, "changed her availability", pro.id, what)
}
