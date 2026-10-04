"use client"

import { usePathname } from "next/navigation"
import { Eye } from "lucide-react"

/** Shown while an editor previews drafts (Next draft mode): what they see isn't live yet. */
export function PreviewBar() {
  const pathname = usePathname()
  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 inset-x-0 z-[60] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-foreground text-background ps-4 pe-1.5 py-1.5 text-xs shadow-xl" dir="ltr">
        <Eye className="w-4 h-4 text-brand" />
        <span>Preview: you're seeing unpublished drafts.</span>
        <a href={`/api/cms/preview?exit=1&path=${encodeURIComponent(pathname)}`} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">
          Exit preview
        </a>
      </div>
    </div>
  )
}
