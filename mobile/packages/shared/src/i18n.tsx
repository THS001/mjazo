import { getLocales } from "expo-localization"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { prefs } from "./storage"

// The app's language: English or Urdu (and Roman Urdu in the pro app). Starts from what the person
// chose before, else the phone's language. Urdu screens read right to left: text aligns right and
// rows run the other way (useDir), without restarting the app.

export type Lang = "en" | "ur" | "ro"
/** A string table: every key in English, with Urdu (and Roman Urdu) where written. */
export type Table = Record<string, { en: string; ur?: string; ro?: string }>
export type Strings<T extends Table> = { [K in keyof T]: string }

const KEY = "mjazo.lang"

type Ctx = { lang: Lang; setLang: (l: Lang) => void; ready: boolean }
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, ready: false })

export function LangProvider({ children, langs }: { children: ReactNode; langs: Lang[] }) {
  const [lang, setState] = useState<Lang>("en")
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void prefs.get<Lang | null>(KEY, null).then((saved) => {
      const device = getLocales()[0]?.languageCode === "ur" ? "ur" : "en"
      setState(saved && langs.includes(saved) ? saved : device)
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const value = useMemo(
    () => ({
      lang,
      ready,
      setLang: (l: Lang) => {
        setState(l)
        void prefs.set(KEY, l)
      },
    }),
    [lang, ready],
  )
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

/** The table in the current language (Roman Urdu falls back to English, Urdu to English). */
export function useStrings<T extends Table>(table: T): Strings<T> {
  const { lang } = useLang()
  return useMemo(() => Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v[lang] ?? v.en])) as Strings<T>, [table, lang])
}

/** Right-to-left helpers for Urdu: text alignment and the direction of rows. */
export function useDir() {
  const { lang } = useLang()
  const rtl = lang === "ur"
  return { rtl, row: rtl ? ("row-reverse" as const) : ("row" as const), align: rtl ? ("right" as const) : ("left" as const), start: rtl ? ("flex-end" as const) : ("flex-start" as const) }
}
