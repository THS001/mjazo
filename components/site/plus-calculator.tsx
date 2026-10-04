"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { formatPKR } from "@/lib/catalog"
import { useSite } from "@/components/cms/provider"

export function PlusCalculator() {
  const { plus } = useSite()
  const [spend, setSpend] = useState(6000)
  const [visits, setVisits] = useState(2)
  const yearly = spend * visits * 12 * plus.discount
  const net = Math.round(yearly - plus.price)
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-md p-6 sm:p-8">
      <label className="block">
        <span className="flex justify-between text-sm"><span className="text-white/60">Average spend per visit</span><span>{formatPKR(spend)}</span></span>
        <input type="range" min={2500} max={20000} step={500} value={spend} onChange={(e) => setSpend(+e.target.value)} className="w-full mt-3 accent-[var(--brand)]" />
      </label>
      <label className="block mt-8">
        <span className="flex justify-between text-sm"><span className="text-white/60">Visits per month</span><span>{visits}</span></span>
        <input type="range" min={1} max={6} step={1} value={visits} onChange={(e) => setVisits(+e.target.value)} className="w-full mt-3 accent-[var(--brand)]" />
      </label>
      <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-1 min-[420px]:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-white/50">You save in a year</p>
          <motion.p key={yearly} initial={{ opacity: 0.4, y: -6 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-4xl lg:text-5xl text-brand mt-1 whitespace-nowrap">{formatPKR(Math.round(yearly))}</motion.p>
        </div>
        <div>
          <p className="text-sm text-white/50">After the {formatPKR(plus.price)} fee</p>
          <p className="font-serif text-4xl lg:text-5xl mt-1 whitespace-nowrap">{net >= 0 ? "+" : "−"}PKR {Math.abs(net).toLocaleString("en-PK")}</p>
        </div>
      </div>
    </div>
  )
}
