"use client"

import { Printer } from "lucide-react"

/** Opens the browser's print dialog (which also saves a PDF). Hidden on the printout itself. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="print:hidden h-11 px-5 rounded-full bg-foreground text-background text-sm font-medium inline-flex items-center gap-2">
      <Printer className="w-4 h-4" /> {label}
    </button>
  )
}
