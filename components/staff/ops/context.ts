"use client"

import { createContext, useContext } from "react"
import type { OpsPerm } from "@/lib/ops/access"

// Who is using mission control and what they may do (the server checks every action again), plus
// opening a booking page from anywhere in the console.

export type OpsMe = { name: string; email: string; role: string; roleLabel: string; perms: OpsPerm[] }

type Ctx = { me: OpsMe; can: (...perms: OpsPerm[]) => boolean; openBooking: (id: string) => void }

export const OpsContext = createContext<Ctx>({ me: { name: "", email: "", role: "", roleLabel: "", perms: [] }, can: () => false, openBooking: () => {} })

export const useOps = () => useContext(OpsContext)

export const inputCls = "w-full h-11 rounded-2xl border border-black/10 bg-white px-4 text-[16px] sm:text-sm outline-none focus:border-black disabled:opacity-60"
