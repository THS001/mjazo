import { aiEnabled } from "@/lib/ai/anthropic"
import { getCatalog } from "@/lib/cms/read"
import { karachiNow } from "@/lib/time"
import { handle } from "@/lib/server/api"
import { AuthError, requirePro } from "@/lib/server/session"
import { earningsFor, getPros, safetySweep, syncJobs } from "@/lib/server/ops"
import { jobMinutes, windowIndex } from "@/lib/ops/logic"
import { get } from "@/lib/server/docs"

// The pro app's whole day in one poll: route-ordered jobs, safety prompts, earnings.

export async function GET() {
  return handle(async () => {
    const s = await requirePro()
    const pro = (await getPros()).find((p) => p.id === s.proId)
    const cat = await getCatalog()
    if (!pro || pro.status !== "active") throw new AuthError("pro")
    const today = karachiNow().date
    const jobs = await syncJobs()
    const mine = jobs.filter((j) => j.proId === pro.id && j.date === today && j.status !== "cancelled").sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99) || windowIndex(a.window) - windowIndex(b.window))
    const swept = await safetySweep(mine)
    const upcoming = jobs.filter((j) => j.proId === pro.id && j.date > today && j.status === "assigned").length
    // Brief photos sent by the customer (deleted when the visit ends).
    const photos = new Map<string, string[]>()
    await Promise.all(
      mine
        .filter((j) => j.brief?.hasPhotos && j.status !== "completed")
        .map(async (j) => {
          const a = await get<{ id: string; photos: string[] }>("attachments", j.id)
          if (a) photos.set(j.id, a.photos)
        }),
    )
    return {
      pro: { id: pro.id, name: pro.name, area: cat.getArea(pro.area)?.name ?? pro.area },
      today,
      jobs: swept.map((j) => ({
        id: j.id,
        window: j.window,
        eta: j.eta,
        status: j.status,
        area: cat.getArea(j.area)?.name ?? j.area,
        subArea: j.subArea,
        address: j.address,
        landmark: j.landmark,
        customer: j.customer,
        items: j.items,
        total: j.total,
        payment: j.payment,
        notes: j.notes,
        minutes: jobMinutes(j, cat),
        checkedInAt: j.events.filter((e) => e.type === "checked_in").slice(-1)[0]?.at,
        brief: j.brief ?? null,
        photos: j.status === "completed" ? [] : (photos.get(j.id) ?? []),
        event: j.event ?? null,
        safety: j.safety,
        paid: j.paymentRecord ? { status: j.paymentRecord.status, amount: j.paymentRecord.amount, method: j.paymentRecord.method } : null,
        lastNotes: jobs
          .filter((x) => x.customer.phone === j.customer.phone && x.id !== j.id && x.visitNotes?.length)
          .sort((a, b) => b.date.localeCompare(a.date))
          .flatMap((x) => x.visitNotes!)
          .slice(0, 3),
      })),
      upcoming,
      earnings: await earningsFor(pro.id, jobs),
      ai: aiEnabled(),
    }
  })
}
