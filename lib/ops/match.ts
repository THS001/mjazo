import { dailyCap, eligible, travelMinutes, unavailableReason, windowIndex, type OpsCatalog } from "./logic"
import { isVerified, type Job, type Pro } from "./types"

// Who should take a visit: the pros who can, best first. Used by auto-assign (stage 5: it offers
// the visit to the top pro, then the next if she declines) and by the board's suggestion. Pure, so
// it's easy to test.

export type Candidate = { proId: string; score: number; reasons: string[] }

/**
 * A pro qualifies when she can do the work (skills, women-only), works then (days off, weekly
 * windows, the areas she covers), has no other visit in that window, is under her daily cap, and
 * isn't in `exclude` (she already turned it down). Then, best first: the pro the customer asked
 * for, the shortest drive from where she'll be (her visit just before, or home), the lighter day.
 * `verifiedOnly`: only pros whose verification checklist is complete.
 */
export function rankPros(job: Job, pros: Pro[], dayJobs: Job[], cat: OpsCatalog, o: { exclude?: string[]; verifiedOnly?: boolean } = {}): Candidate[] {
  const out: Candidate[] = []
  for (const p of pros) {
    if (o.exclude?.includes(p.id) || !eligible(p, job, cat) || unavailableReason(p, job)) continue
    if (o.verifiedOnly && !isVerified(p)) continue
    const hers = dayJobs.filter((j) => j.proId === p.id && j.id !== job.id && j.date === job.date && !["cancelled", "no_show"].includes(j.status))
    if (hers.some((j) => j.window === job.window) || hers.length >= dailyCap(p)) continue
    const before = hers.filter((j) => windowIndex(j.window) < windowIndex(job.window)).sort((a, b) => windowIndex(b.window) - windowIndex(a.window))[0]
    const travel = travelMinutes(before?.area ?? p.area, job.area)
    const reasons: string[] = []
    let score = 100 - travel - hers.length * 5
    if (p.id === job.preferredProId) {
      score += 60
      reasons.push("asked for")
    }
    reasons.push(before ? `${travel} min from her visit before` : `${travel} min from home`)
    reasons.push(hers.length ? `${hers.length} other visit${hers.length === 1 ? "" : "s"} that day` : "free that day")
    if (!isVerified(p)) reasons.push("not verified")
    out.push({ proId: p.id, score, reasons })
  }
  return out.sort((a, b) => b.score - a.score || a.proId.localeCompare(b.proId))
}
