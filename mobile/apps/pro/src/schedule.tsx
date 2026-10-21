import type { Schedule } from "@mjazo/shared"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { AppState } from "react-native"
import { useSession } from "./session"

// Her visits for the next two weeks, shared by Today and the visit screen. Fresh when the app
// comes back to the front, every minute while it's open, and after every action.

type Ctx = { schedule: Schedule | null; error: unknown; reload: () => Promise<void> }
const ScheduleContext = createContext<Ctx>({ schedule: null, error: null, reload: async () => {} })

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { session, api } = useSession()
  const signedIn = session.state === "in"
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [error, setError] = useState<unknown>(null)
  const reload = useCallback(async () => {
    if (!signedIn) return
    try {
      setSchedule(await api<Schedule>("/api/v1/pro/jobs?days=14"))
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api, signedIn])
  useEffect(() => {
    if (!signedIn) return setSchedule(null)
    void reload()
    const timer = setInterval(() => void reload(), 60_000)
    const sub = AppState.addEventListener("change", (s) => s === "active" && void reload())
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [signedIn, reload])
  const value = useMemo(() => ({ schedule, error, reload }), [schedule, error, reload])
  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export const useSchedule = () => useContext(ScheduleContext)
