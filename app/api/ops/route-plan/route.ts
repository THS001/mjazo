import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { getCatalog } from "@/lib/cms/read"
import type { Catalog } from "@/lib/catalog"
import { handle, readJson } from "@/lib/server/api"
import { requireOps } from "@/lib/server/session"
import { assignJob, getPros, syncJobs } from "@/lib/server/ops"
import { gapFillCandidates, planRoutes, travelMinutes, windowIndex } from "@/lib/ops/logic"
import type { Job } from "@/lib/ops/types"

// Route Brain: plan (and optionally apply) the day's assignments, and suggest gap-fill customers.

const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), apply: z.boolean().optional() })
const first = (n: string) => n.split(" ")[0]
const areaName = (cat: Catalog, slug: string) => cat.getArea(slug)?.name ?? slug

/** Travel minutes for the assignments as they stand now (for the before/after comparison). */
function currentTravel(jobs: Job[], homes: Map<string, string>) {
  const byPro = new Map<string, Job[]>()
  for (const j of jobs) if (j.proId) byPro.set(j.proId, [...(byPro.get(j.proId) ?? []), j])
  let total = 0
  for (const [id, js] of byPro) {
    let at = homes.get(id) ?? js[0].area
    for (const j of js.sort((a, b) => windowIndex(a.window) - windowIndex(b.window))) {
      total += travelMinutes(at, j.area)
      at = j.area
    }
  }
  return total
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const { date, apply } = body.parse(await readJson(req))
    const [jobs, allPros] = await Promise.all([syncJobs(), getPros()])
    const pros = allPros.filter((p) => p.status === "active")
    const day = jobs.filter((j) => j.date === date && j.status !== "cancelled" && j.status !== "completed")
    const cat = await getCatalog()
    const plan = planRoutes(day, pros, jobs, cat)
    const before = currentTravel(day, new Map(pros.map((p) => [p.id, p.area])))

    if (apply) await audit("ops", "applied Route Brain plan", date, plan.travelTotal + " min travel, " + plan.unassigned.length + " unassigned")
    if (apply) {
      for (const [proId, stops] of Object.entries(plan.byPro))
        for (const [i, s] of stops.entries()) {
          const j = day.find((x) => x.id === s.jobId)
          if (j && (j.status === "new" || j.status === "assigned")) await assignJob(s.jobId, proId, { eta: s.eta, routeOrder: i + 1 })
        }
    }

    const byId = new Map(jobs.map((j) => [j.id, j]))
    const booked = new Set(jobs.filter((j) => j.date === date).map((j) => j.customer.phone))
    const gaps = Object.entries(plan.byPro)
      .filter(([, stops]) => stops.length < 3)
      .map(([proId, stops]) => {
        const near = byId.get(stops[stops.length - 1].jobId)!
        const pro = pros.find((p) => p.id === proId)!
        return {
          proId,
          proName: pro.name,
          area: areaName(cat, near.area),
          candidates: gapFillCandidates(near, jobs, date, booked).map((c) => ({
            name: c.job.customer.name,
            phone: c.job.customer.phone,
            area: areaName(cat, c.job.area),
            lastDate: c.job.date,
            daysSince: c.daysSince,
            services: c.job.items.map((i) => i.name).join(", "),
            message: `Assalam o Alaikum ${first(c.job.customer.name)}! ${first(pro.name)} from Mjazo will be in ${areaName(cat, near.area)} on ${date}. It has been ${c.daysSince} days since your ${c.job.items[0]?.name ?? "last visit"}. Would you like a slot? Reply here to book.`,
          })),
        }
      })
      .filter((g) => g.candidates.length)

    const describe = (j: Job) => ({ id: j.id, window: j.window, area: areaName(cat, j.area), customer: first(j.customer.name), services: j.items.map((i) => i.name).join(", "), status: j.status })
    return {
      applied: Boolean(apply),
      before,
      after: plan.travelTotal,
      perProDay: plan.perProDay,
      routes: Object.entries(plan.byPro).map(([proId, stops]) => {
        const pro = pros.find((p) => p.id === proId)
        return { proId, proName: pro?.name ?? proId, home: pro ? areaName(cat, pro.area) : "", stops: stops.map((s) => ({ ...s, job: describe(byId.get(s.jobId)!) })) }
      }),
      unassigned: plan.unassigned.map((u) => ({ ...u, job: describe(byId.get(u.jobId)!) })),
      gaps,
    }
  })
}
