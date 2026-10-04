"use client"

import { useState, type ReactNode } from "react"
import { Check, Loader2 } from "lucide-react"
import { submit, track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { PK_PHONE, normalisePhone } from "./notify-form"
import { Pill } from "./primitives"
import { useSite, useT } from "@/components/cms/provider"

export const inputCls =
  "w-full h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-[16px] sm:text-sm outline-none transition-colors focus:border-foreground placeholder:text-zinc-400 aria-[invalid=true]:border-destructive"

export function Field({ label, error, children, hint, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-zinc-500 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-destructive mt-1">{error}</span>}
    </label>
  )
}

export function Chips({ options, value, onChange, multi }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id)
        return (
          <button
            type="button"
            key={o.id}
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.id) : [...value, o.id]) : [o.id])}
            className={cn("rounded-full border px-4 h-10 text-sm transition-colors", on ? "bg-foreground text-background border-foreground" : "border-zinc-300 hover:border-zinc-500 bg-white")}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SuccessCard({ title, body, children }: { title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center">
      <svg viewBox="0 0 52 52" className="w-16 h-16 mx-auto mb-5 animate-draw-icon" aria-hidden>
        <circle cx="26" cy="26" r="24" fill="none" stroke="var(--brand)" strokeWidth="2" />
        <path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="font-serif text-3xl">{title}</p>
      <div className="text-zinc-600 mt-2">{body}</div>
      {children}
    </div>
  )
}

type Extra = { name: string; label: string; type: "text" | "date" | "number" | "select" | "chips" | "textarea"; options?: string[]; required?: boolean; multi?: boolean; placeholder?: string }

/** Generic enquiry form (weddings, business, contact, gift cards, Plus waitlist). */
export function EnquiryForm({
  kind,
  extras = [],
  submitLabel,
  whatsappText,
  success,
  dark,
}: {
  kind: "wedding" | "business" | "contact" | "gift" | "plus"
  extras?: Extra[]
  submitLabel?: string
  whatsappText?: string
  success?: string
  dark?: boolean
}) {
  const { whatsappLink } = useSite()
  const t = useT()
  const [values, setValues] = useState<Record<string, string | string[]>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const [serverError, setServerError] = useState("")
  const set = (k: string, v: string | string[]) => setValues((s) => ({ ...s, [k]: v }))
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (str("name").trim().length < 2) errs.name = t.form.errName
    if (!PK_PHONE.test(normalisePhone(str("phone")))) errs.phone = t.notify.errPhone
    if (str("email") && !/^\S+@\S+\.\S+$/.test(str("email"))) errs.email = t.form.errEmail
    for (const x of extras) {
      const v = values[x.name]
      if (x.required && (!v || (Array.isArray(v) && v.length === 0))) errs[x.name] = t.form.required
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    setState("loading")
    setServerError("")
    try {
      const details = Object.fromEntries(extras.map((x) => [x.name, values[x.name] ?? ""]))
      await submit("enquiry", { kind, name: str("name"), phone: normalisePhone(str("phone")), email: str("email"), message: str("message"), details })
      track(kind === "wedding" || kind === "business" ? "event_enquiry" : `${kind}_enquiry`, { kind })
      setState("done")
    } catch (err) {
      setState("idle")
      setServerError((err as Error).message)
    }
  }

  if (state === "done") return <SuccessCard title={t.form.successTitle} body={success ?? t.form.successBody} />

  const box = dark ? "bg-white/5 backdrop-blur-md border-white/15 text-white" : "bg-white border-zinc-200"
  return (
    <form onSubmit={onSubmit} noValidate className={cn("rounded-3xl border p-6 sm:p-8 grid sm:grid-cols-2 gap-5", box)}>
      <Field label={t.form.name} error={errors.name}>
        <input className={inputCls} value={str("name")} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} autoComplete="name" />
      </Field>
      <Field label={t.form.phone} error={errors.phone}>
        <input className={inputCls} value={str("phone")} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" />
      </Field>
      <Field label={t.form.email} error={errors.email} className="sm:col-span-2">
        <input className={inputCls} value={str("email")} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} inputMode="email" autoComplete="email" />
      </Field>
      {extras.map((x) => (
        <Field key={x.name} label={x.label} error={errors[x.name]} className={x.type === "chips" || x.type === "textarea" ? "sm:col-span-2" : ""}>
          {x.type === "select" ? (
            <select className={cn(inputCls, "text-black")} value={str(x.name)} onChange={(e) => set(x.name, e.target.value)} aria-invalid={!!errors[x.name]}>
              <option value="">{t.form.choose}</option>
              {x.options?.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : x.type === "chips" ? (
            <Chips options={(x.options ?? []).map((o) => ({ id: o, label: o }))} value={(values[x.name] as string[]) ?? []} onChange={(v) => set(x.name, v)} multi={x.multi} />
          ) : x.type === "textarea" ? (
            <textarea className={cn(inputCls, "h-28 py-3 text-black")} value={str(x.name)} onChange={(e) => set(x.name, e.target.value)} placeholder={x.placeholder} />
          ) : (
            <input className={cn(inputCls, "text-black")} type={x.type} value={str(x.name)} onChange={(e) => set(x.name, e.target.value)} aria-invalid={!!errors[x.name]} placeholder={x.placeholder} min={x.type === "number" ? 1 : undefined} />
          )}
        </Field>
      ))}
      <Field label={t.form.message} className="sm:col-span-2">
        <textarea className={cn(inputCls, "h-28 py-3 text-black")} value={str("message")} onChange={(e) => set("message", e.target.value)} />
      </Field>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <Pill type="submit" variant={dark ? "brand" : "solid"} disabled={state === "loading"}>
          {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (submitLabel ?? t.form.send)}
        </Pill>
        {whatsappText && (
          <a href={whatsappLink(whatsappText)} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { placement: `${kind}_form` })} className={cn("inline-block py-2 text-sm underline underline-offset-4", dark ? "text-white/80" : "text-zinc-600")}>
            {t.form.preferWhatsapp}
          </a>
        )}
        {serverError && <p className="text-sm text-destructive basis-full">{serverError}</p>}
      </div>
    </form>
  )
}


export function CheckList({ items, className, dark }: { items: string[]; className?: string; dark?: boolean }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((x) => (
        <li key={x} className="flex gap-3 text-sm">
          <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3 h-3 text-black" strokeWidth={3} /></span>
          <span className={dark ? "text-white/85" : "text-zinc-700"}>{x}</span>
        </li>
      ))}
    </ul>
  )
}
