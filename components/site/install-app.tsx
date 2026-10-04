"use client"

import { useEffect, useState } from "react"
import { Check, Download, PlusSquare, Share } from "lucide-react"
import { track } from "@/lib/site"

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** "Install Mjazo" — native install prompt on Android/Chrome/Edge, step-by-step on iPhone. */
export function InstallApp() {
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    setInstalled(window.matchMedia("(display-mode: standalone)").matches)
    const on = (e: Event) => {
      e.preventDefault()
      setEvt(e as BIPEvent)
    }
    const done = () => setInstalled(true)
    window.addEventListener("beforeinstallprompt", on)
    window.addEventListener("appinstalled", done)
    return () => {
      window.removeEventListener("beforeinstallprompt", on)
      window.removeEventListener("appinstalled", done)
    }
  }, [])

  if (installed)
    return <p className="flex items-center gap-2 text-brand-ink"><Check className="w-5 h-5" /> Mjazo is installed on this device.</p>

  return (
    <div className="space-y-4">
      {evt && (
        <button
          onClick={async () => {
            await evt.prompt()
            const r = await evt.userChoice
            track("install_app", { outcome: r.outcome })
            if (r.outcome === "accepted") setInstalled(true)
          }}
          className="h-14 px-7 rounded-full bg-foreground text-background flex items-center gap-2 font-medium hover:bg-brand hover:text-foreground transition-colors"
        >
          <Download className="w-5 h-5" /> Install Mjazo
        </button>
      )}
      <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
        <div className={`rounded-3xl border p-5 ${ios ? "border-foreground bg-white" : "border-zinc-200 bg-white/70"}`}>
          <p className="font-medium">iPhone & iPad</p>
          <ol className="mt-3 space-y-2 text-sm text-zinc-600">
            <li className="flex gap-2"><span className="text-zinc-400">1.</span>Open mjazo in Safari</li>
            <li className="flex gap-2 items-center"><span className="text-zinc-400">2.</span>Tap <Share className="w-4 h-4 inline" /> Share</li>
            <li className="flex gap-2 items-center"><span className="text-zinc-400">3.</span>Tap <PlusSquare className="w-4 h-4 inline" /> Add to Home Screen</li>
          </ol>
        </div>
        <div className={`rounded-3xl border p-5 ${!ios ? "border-foreground bg-white" : "border-zinc-200 bg-white/70"}`}>
          <p className="font-medium">Android</p>
          <ol className="mt-3 space-y-2 text-sm text-zinc-600">
            <li className="flex gap-2"><span className="text-zinc-400">1.</span>Open mjazo in Chrome</li>
            <li className="flex gap-2"><span className="text-zinc-400">2.</span>Tap the ⋮ menu</li>
            <li className="flex gap-2"><span className="text-zinc-400">3.</span>Tap Install app</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
