"use client"

import { useState } from "react"
import { Check, MapPin } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useLocation } from "@/lib/store"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { NotifyForm } from "./notify-form"
import { StatusChip } from "./primitives"
import { useCatalog } from "@/components/cms/provider"

export function LocationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { areas, getArea } = useCatalog()
  const loc = useLocation()
  const [picked, setPicked] = useState<string | null>(loc.area)
  const area = picked ? getArea(picked) : undefined

  const choose = (slug: string, sub: string | null = null) => {
    loc.set(slug, sub)
    track("set_location", { area: slug, sub_area: sub ?? "" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-lg max-h-[88svh] overflow-y-auto overscroll-contain" data-lenis-prevent>
        <DialogTitle className="font-serif text-3xl font-normal">Where should we come?</DialogTitle>
        <DialogDescription>We come to 8 neighbourhoods across Karachi. Pick yours, then your sub-area.</DialogDescription>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {areas.map((a) => (
            <button
              key={a.slug}
              onClick={() => setPicked(a.slug)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-2xl border px-4 py-3 text-left transition-colors",
                picked === a.slug ? "border-foreground bg-zinc-50" : "border-zinc-200 hover:border-zinc-400",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium"><MapPin className="w-3.5 h-3.5" />{a.name}</span>
              <StatusChip status={a.status} liveLabel="Live" />
            </button>
          ))}
        </div>

        {area?.status === "live" && (
          <div className="mt-2">
            <p className="text-sm text-zinc-500 mb-2">Pick your {area.name} sub-area</p>
            <div className="flex flex-wrap gap-2">
              {area.subAreas.map((sub) => (
                <button key={sub} onClick={() => choose(area.slug, sub)} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-foreground", loc.area === area.slug && loc.subArea === sub ? "border-foreground bg-foreground text-background" : "border-zinc-200")}>
                  {loc.area === area.slug && loc.subArea === sub && <Check className="inline w-3.5 h-3.5 mr-1" />}
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {area && area.status !== "live" && (
          <div className="mt-2 rounded-2xl bg-zinc-50 p-4">
            <p className="text-sm mb-3">We're not in <b>{area.name}</b> yet. Join the list and we'll WhatsApp you the day we open.</p>
            <NotifyForm area={area.slug} source="location-dialog" compact onDone={() => choose(area.slug)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
