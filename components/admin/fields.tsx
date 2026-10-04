"use client"

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChartColumn, ChevronDown, Columns2, Copy, Film, GripVertical, HelpCircle, Images, LayoutGrid, LayoutTemplate, Lock, Megaphone, MessageSquareText, Plus, Search, SeparatorHorizontal, ShieldCheck, Sparkles, Tag, Trash2, Type, Wand2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ICONS } from "@/components/site/primitives"
import { emptyObject, emptyOf, localizeObject, type BlockDef, type BlocksField, type Field, type Fields, type Localized, type MediaRef, type RichDoc } from "@/lib/cms/fields"
import { RichTextEditor } from "./rich-text-editor"
import { MediaInput } from "./media"
import { SeoGroup } from "./seo-group"

// Form controls generated from a content type's fields. Localised fields show English and Urdu
// side by side; price fields lock for people without the "prices" permission.

export type FormCtx = {
  showUr: boolean
  canPrices: boolean
  canMedia: boolean
  /** Whether fields with perm "seo" are editable (not for Authors). */
  canSeo?: boolean
  /** The SEO role: only fields with perm "seo" are editable. */
  seoOnly?: boolean
  readOnly: boolean
  entryType?: string
  /** The entry's page address (for the SEO preview), and the whole entry (for AI suggestions). */
  path?: string | null
  root?: Record<string, unknown>
  refs: Record<string, { id: string; title: string }[]>
}

type V = unknown
const isLoc = (fd: Field) => fd.kind === "richText" || ((fd.kind === "text" || fd.kind === "textarea") && fd.localized !== false)
const inputCls = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-foreground disabled:bg-zinc-50 disabled:text-zinc-500"
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)

export { emptyOf, emptyObject }

/** A short label for a list item, from its `itemLabel` field (English). */
function itemTitle(fd: Field, v: V, i: number, refs: FormCtx["refs"]): string {
  if (fd.kind !== "group") {
    const t = typeof v === "object" && v && "en" in (v as object) ? (v as Localized).en : v
    return String(t ?? "") || `Item ${i + 1}`
  }
  const key = (fd as Field & { itemLabel?: string }).itemLabel
  const obj = (v ?? {}) as Record<string, V>
  const first = key ?? Object.keys(fd.fields)[0]
  const raw = obj[first]
  const sub = fd.fields[first]
  if (sub?.kind === "ref") return refs[sub.to]?.find((o) => o.id === raw)?.title ?? String(raw ?? "")
  const s = typeof raw === "object" && raw && "en" in (raw as object) ? (raw as Localized).en : raw
  return String(s ?? "") || `Item ${i + 1}`
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * The fields of a type, group or list item. `path` is where they sit in the entry ("blocks.2"), so
 * every field's wrapper carries its full path in data-field (click-to-edit finds fields by it).
 */
export function FieldsForm({ fields, value, onChange, ctx, path }: { fields: Fields; value: Record<string, V>; onChange: (v: Record<string, V>) => void; ctx: FormCtx; path?: string }) {
  return (
    <div className="grid grid-cols-6 gap-x-4 gap-y-5">
      {Object.entries(fields).map(([k, fd]) => {
        const full = path ? `${path}.${k}` : k
        return (
          <div key={k} data-field={full} className={cn("col-span-6 rounded-xl", !(ctx.showUr && isLoc(fd)) && fd.width === "half" && "sm:col-span-3", !(ctx.showUr && isLoc(fd)) && fd.width === "third" && "sm:col-span-2")}>
            <FieldInput name={full} field={fd} value={value?.[k]} onChange={(x) => onChange({ ...value, [k]: x })} ctx={ctx} siblings={value} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Asks the form to show a field: lists and blocks open the item it's in, then the field is scrolled
 * into view, focused and flashed. Used by click-to-edit in the live preview.
 */
export function revealField(path: string, lang: "en" | "ur" = "en") {
  window.dispatchEvent(new CustomEvent("cms:reveal", { detail: path }))
  // Wait for opened items to render.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const parts = path.split(".")
      let el: HTMLElement | null = null
      // The field itself, else the nearest parent that exists (a block, a list item).
      for (let n = parts.length; n > 0 && !el; n--) el = document.querySelector<HTMLElement>(`[data-field="${parts.slice(0, n).join(".")}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      const inputs = [...el.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), [contenteditable=true]")]
      const target = inputs.find((i) => (lang === "ur" ? i.getAttribute("lang") === "ur" || i.getAttribute("dir") === "rtl" : i.getAttribute("lang") !== "ur" && i.getAttribute("dir") !== "rtl")) ?? inputs[0]
      target?.focus({ preventScroll: true })
      el.classList.add("cms-flash")
      setTimeout(() => el?.classList.remove("cms-flash"), 1600)
    }),
  )
}

/** Opens the item of a list or blocks field (at `name`) that a revealed path points into. */
function useReveal(name: string, onIndex: (i: number) => void) {
  const cb = useRef(onIndex)
  cb.current = onIndex
  useEffect(() => {
    const h = (e: Event) => {
      const path = (e as CustomEvent<string>).detail
      if (!path.startsWith(`${name}.`)) return
      const i = Number(path.slice(name.length + 1).split(".")[0])
      if (Number.isInteger(i)) cb.current(i)
    }
    window.addEventListener("cms:reveal", h)
    return () => window.removeEventListener("cms:reveal", h)
  }, [name])
}

function Label({ field, extra, locked }: { field: Field; extra?: ReactNode; locked?: boolean }) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-3">
      <div>
        <span className="text-[13px] font-medium">
          {field.label}
          {field.required && <span className="text-brand-ink"> *</span>}
        </span>
        {locked && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-zinc-400">
            <Lock className="w-3 h-3" /> Owner or Admin
          </span>
        )}
        {field.help && <p className="text-xs text-zinc-500 mt-0.5">{field.help}</p>}
      </div>
      {extra}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One field
// ---------------------------------------------------------------------------

export function FieldInput({ name, field: fd, value, onChange, ctx: outer, siblings }: { name: string; field: Field; value: V; onChange: (v: V) => void; ctx: FormCtx; siblings?: Record<string, V> }) {
  // The SEO role sees everything but can change SEO fields only (and everything inside an SEO group).
  // Roles without "seo" (Authors) see SEO fields locked.
  const ctx =
    outer.seoOnly && fd.perm === "seo"
      ? { ...outer, seoOnly: false }
      : outer.seoOnly && fd.kind !== "group" && fd.kind !== "list"
        ? { ...outer, readOnly: true }
        : fd.perm === "seo" && outer.canSeo === false
          ? { ...outer, readOnly: true }
          : outer
  const ro = ctx.readOnly
  switch (fd.kind) {
    case "text":
    case "textarea": {
      if (fd.localized === false) {
        return (
          <div>
            <Label field={fd} />
            <TextBox multiline={fd.kind === "textarea"} mono={fd.mono} value={String(value ?? "")} onChange={onChange} disabled={ro} placeholder={fd.placeholder} />
          </div>
        )
      }
      const l = (value ?? { en: "" }) as Localized
      const over = fd.max && l.en.length > fd.max
      return (
        <div>
          <Label field={fd} extra={fd.max ? <span className={cn("text-[11px] tabular-nums", over ? "text-red-600" : "text-zinc-400")}>{l.en.length}/{fd.max}</span> : null} />
          <div className={cn("grid gap-2", ctx.showUr && "sm:grid-cols-2")}>
            <TextBox multiline={fd.kind === "textarea"} value={l.en} onChange={(en) => onChange({ ...l, en })} disabled={ro} placeholder={fd.placeholder} lang="en" />
            {ctx.showUr && (
              <div className="relative">
                <TextBox multiline={fd.kind === "textarea"} value={l.ur ?? ""} onChange={(ur) => onChange({ ...l, ur, ai: false })} disabled={ro} placeholder="اردو" urdu />
                {l.ai && l.ur && (
                  <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-800">
                    <Sparkles className="w-3 h-3" /> AI translation, needs review
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }
    case "number":
      return (
        <div>
          <Label field={fd} />
          <div className="relative">
            <input type="number" className={cn(inputCls, fd.unit && "pr-14")} value={Number(value ?? 0)} min={fd.min} max={fd.max} step={fd.step ?? 1} disabled={ro} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
            {fd.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{fd.unit}</span>}
          </div>
        </div>
      )
    case "price": {
      const locked = !ctx.canPrices
      return (
        <div>
          <Label field={fd} locked={locked} />
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">PKR</span>
            <input type="number" className={cn(inputCls, "pl-12 tabular-nums")} value={Number(value ?? 0)} step={50} disabled={ro || locked} onChange={(e) => onChange(e.target.value === "" ? 0 : Math.round(Number(e.target.value)))} />
          </div>
        </div>
      )
    }
    case "boolean":
      return (
        <label className={cn("flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5", !ro && "cursor-pointer")}>
          <Switch checked={Boolean(value)} onChange={onChange} disabled={ro} />
          <span>
            <span className="block text-[13px] font-medium">{fd.label}</span>
            {fd.help && <span className="block text-xs text-zinc-500">{fd.help}</span>}
          </span>
        </label>
      )
    case "select":
      return (
        <div>
          <Label field={fd} />
          <select className={inputCls} value={String(value ?? "")} disabled={ro} onChange={(e) => onChange(e.target.value)}>
            {fd.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )
    case "ref": {
      const opts = ctx.refs[fd.to] ?? []
      const v = String(value ?? "")
      return (
        <div>
          <Label field={fd} />
          <select className={inputCls} value={v} disabled={ro} onChange={(e) => onChange(e.target.value)}>
            {!opts.some((o) => o.id === v) && <option value={v}>{v || "Choose…"}</option>}
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
      )
    }
    case "color":
      return (
        <div>
          <Label field={fd} />
          <div className="flex items-center gap-2">
            <input type="color" value={String(value ?? "#ffffff")} disabled={ro} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" />
            <TextBox mono value={String(value ?? "")} onChange={onChange} disabled={ro} />
          </div>
        </div>
      )
    case "slug": {
      const from = siblings?.name ?? siblings?.title
      const fromText = typeof from === "object" && from && "en" in (from as object) ? (from as Localized).en : typeof from === "string" ? from : ""
      return (
        <div>
          <Label
            field={fd}
            extra={
              !ro && fromText ? (
                <button type="button" onClick={() => onChange(slugify(fromText))} className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-foreground">
                  <Wand2 className="w-3 h-3" /> From name
                </button>
              ) : null
            }
          />
          <TextBox mono value={String(value ?? "")} onChange={(x) => onChange(x.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} disabled={ro} />
          <p className="mt-1 text-[11px] text-zinc-400">Part of the web address. Changing it later breaks old links unless you add a redirect.</p>
        </div>
      )
    }
    case "icon":
      return (
        <div>
          <Label field={fd} />
          <IconPicker value={String(value ?? "")} onChange={onChange} disabled={ro} />
        </div>
      )
    case "group": {
      const form = <FieldsForm fields={fd.fields} value={(value ?? {}) as Record<string, V>} onChange={onChange} ctx={ctx} path={name} />
      if (fd.ui === "seo")
        return (
          <SeoGroup field={fd} value={(value ?? {}) as Record<string, V>} onChange={onChange} ctx={ctx}>
            {form}
          </SeoGroup>
        )
      return (
        <fieldset className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
          <legend className="px-1 text-[13px] font-semibold">{fd.label}</legend>
          {fd.help && <p className="mb-3 text-xs text-zinc-500">{fd.help}</p>}
          {form}
        </fieldset>
      )
    }
    case "list":
      return <ListEditor name={name} field={fd} value={Array.isArray(value) ? value : []} onChange={onChange} ctx={ctx} />
    case "blocks":
      return <BlocksEditor name={name} field={fd} value={Array.isArray(value) ? value : []} onChange={onChange} ctx={ctx} />
    case "richText": {
      const l = (value ?? { en: { type: "doc", content: [] } }) as Localized<RichDoc>
      return (
        <div>
          <Label field={fd} />
          <div className={cn("grid gap-3", ctx.showUr && "xl:grid-cols-2")}>
            <RichTextEditor value={l.en} onChange={(en) => onChange({ ...l, en })} disabled={ro} />
            {ctx.showUr && (
              <div>
                <p className="mb-1 text-[11px] text-zinc-400">اردو {l.ai && l.ur ? "· AI translation, needs review" : ""}</p>
                <RichTextEditor value={l.ur} onChange={(ur) => onChange({ ...l, ur, ai: false })} urdu disabled={ro} />
              </div>
            )}
          </div>
        </div>
      )
    }
    case "date":
      return (
        <div>
          <Label field={fd} />
          <input type="date" className={inputCls} value={String(value ?? "")} disabled={ro} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    case "image":
      return (
        <div>
          <Label field={fd} />
          <MediaInput value={value as MediaRef | null} onChange={onChange} accept={fd.accept ?? "image"} disabled={ro} canUpload={ctx.canMedia} showUr={ctx.showUr} />
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function TextBox({ value, onChange, multiline, mono, urdu, disabled, placeholder, lang }: { value: string; onChange: (v: string) => void; multiline?: boolean; mono?: boolean; urdu?: boolean; disabled?: boolean; placeholder?: string; lang?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // Grow textareas with their content.
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(480, el.scrollHeight + 2)}px`
  }, [value])
  const props = {
    value,
    disabled,
    placeholder,
    lang: urdu ? "ur" : lang,
    dir: urdu ? ("rtl" as const) : undefined,
    className: cn(inputCls, mono && "font-mono text-[13px]", urdu && "font-urdu text-[15px] leading-loose"),
  }
  return multiline ? <textarea ref={ref} rows={2} {...props} onChange={(e) => onChange(e.target.value)} className={cn(props.className, "resize-none")} /> : <input {...props} onChange={(e) => onChange(e.target.value)} />
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
      className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-foreground" : "bg-zinc-300")}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  )
}

function IconPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const names = useMemo(() => Object.keys(ICONS).filter((n) => n.toLowerCase().includes(q.toLowerCase())), [q])
  const Current = ICONS[value]
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} className={cn(inputCls, "flex items-center gap-2 text-left")}>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-100">{Current ? <Current className="w-4 h-4" strokeWidth={1.5} /> : "?"}</span>
        <span className="flex-1">{value || "Choose an icon"}</span>
        <ChevronDown className="w-4 h-4 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons" className={cn(inputCls, "pl-9")} />
          </div>
          <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
            {names.map((n) => {
              const C = ICONS[n]
              return (
                <button
                  key={n}
                  type="button"
                  title={n}
                  onClick={() => {
                    onChange(n)
                    setOpen(false)
                  }}
                  className={cn("grid aspect-square place-items-center rounded-lg hover:bg-zinc-100", n === value && "bg-brand-soft")}
                >
                  <C className="w-5 h-5" strokeWidth={1.5} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lists (sortable)
// ---------------------------------------------------------------------------

let seq = 0
const newKey = () => `k${++seq}`

function ListEditor({ name, field: fd, value, onChange, ctx }: { name: string; field: Extract<Field, { kind: "list" }>; value: V[]; onChange: (v: V[]) => void; ctx: FormCtx }) {
  // Stable keys for items, so reordering and deleting keep each item's state.
  const [keys, setKeys] = useState<string[]>(() => value.map(newKey))
  useEffect(() => {
    if (keys.length !== value.length) setKeys((k) => (value.length > k.length ? [...k, ...value.slice(k.length).map(newKey)] : k.slice(0, value.length)))
  }, [value, keys.length])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const dndId = useId()
  const scalar = fd.of.kind !== "group"
  const [open, setOpen] = useState<Set<string>>(new Set())
  useReveal(name, (i) => keys[i] && setOpen((o) => new Set([...o, keys[i]])))
  const ro = ctx.readOnly
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = keys.indexOf(String(e.active.id))
    const to = keys.indexOf(String(e.over.id))
    setKeys(arrayMove(keys, from, to))
    onChange(arrayMove(value, from, to))
  }
  const add = () => {
    const k = newKey()
    setKeys([...keys, k])
    onChange([...value, emptyOf(fd.of)])
    if (!scalar) setOpen(new Set([...open, k]))
  }
  const remove = (i: number) => {
    setKeys(keys.filter((_, j) => j !== i))
    onChange(value.filter((_, j) => j !== i))
  }
  const duplicate = (i: number) => {
    const k = newKey()
    setKeys([...keys.slice(0, i + 1), k, ...keys.slice(i + 1)])
    onChange([...value.slice(0, i + 1), structuredClone(value[i]), ...value.slice(i + 1)])
  }
  const atMax = fd.max !== undefined && value.length >= fd.max
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <div>
          <span className="text-[13px] font-medium">{fd.label}</span> <span className="text-xs text-zinc-400">{value.length}</span>
          {fd.help && <p className="text-xs text-zinc-500 mt-0.5">{fd.help}</p>}
        </div>
        {!scalar && value.length > 1 && (
          <button type="button" onClick={() => setOpen(open.size ? new Set() : new Set(keys))} className="text-[11px] text-zinc-500 hover:text-foreground">
            {open.size ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      {/* useId: dnd-kit's own id counter differs between the server and the browser (hydration mismatch). */}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {value.map((item, i) => (
              <SortableRow key={keys[i] ?? i} id={keys[i] ?? String(i)} disabled={ro}>
                {(handle) =>
                  scalar ? (
                    <div className="flex items-start gap-2" data-field={`${name}.${i}`}>
                      {handle}
                      <div className="flex-1">
                        <FieldInput name={`${name}.${i}`} field={{ ...fd.of, label: "", help: undefined }} value={item} onChange={(x) => onChange(value.map((y, j) => (j === i ? x : y)))} ctx={ctx} />
                      </div>
                      {!ro && (
                        <button type="button" onClick={() => remove(i)} className="mt-2 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-white" data-field={`${name}.${i}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        {handle}
                        <button
                          type="button"
                          onClick={() => {
                            const n = new Set(open)
                            if (n.has(keys[i])) n.delete(keys[i])
                            else n.add(keys[i])
                            setOpen(n)
                          }}
                          className="flex flex-1 items-center gap-2 py-1 text-left text-sm"
                        >
                          <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", !open.has(keys[i]) && "-rotate-90")} />
                          <span className="truncate">{itemTitle({ ...fd.of, itemLabel: fd.itemLabel } as Field, item, i, ctx.refs)}</span>
                        </button>
                        {!ro && (
                          <>
                            {!atMax && (
                              <button type="button" onClick={() => duplicate(i)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-foreground" aria-label="Duplicate">
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                            <button type="button" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                      {open.has(keys[i]) && fd.of.kind === "group" && (
                        <div className="border-t border-zinc-100 p-4">
                          <FieldsForm fields={fd.of.fields} value={(item ?? {}) as Record<string, V>} onChange={(x) => onChange(value.map((y, j) => (j === i ? x : y)))} ctx={ctx} path={`${name}.${i}`} />
                        </div>
                      )}
                    </div>
                  )
                }
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!ro && !atMax && (
        <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-foreground hover:text-foreground">
          <Plus className="w-3.5 h-3.5" /> Add {fd.of.kind === "group" ? fd.of.label.toLowerCase() : "item"}
        </button>
      )}
    </div>
  )
}

function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const handle = disabled ? null : (
    <button type="button" {...attributes} {...listeners} className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded text-zinc-300 hover:text-zinc-600 active:cursor-grabbing" aria-label="Drag to reorder">
      <GripVertical className="w-4 h-4" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(isDragging && "relative z-10 opacity-80")}>
      {children(handle)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Blocks (the page builder)
// ---------------------------------------------------------------------------

const BLOCK_ICONS: Record<string, LucideIcon> = { LayoutTemplate, Type, Columns2, LayoutGrid, Tag, HelpCircle, Megaphone, ShieldCheck, ChartColumn, Film, Images, MessageSquareText, SeparatorHorizontal }
const BlockIcon = ({ name, className }: { name?: string; className?: string }) => {
  const C = (name && BLOCK_ICONS[name]) || LayoutGrid
  return <C className={className} strokeWidth={1.75} />
}
const newBlockKey = () => Math.random().toString(36).slice(2, 10)

/** A one-line summary of a block for its header: its first text, without accent marks. */
function blockSummary(def: BlockDef, item: Record<string, V>): string {
  for (const [k, fd] of Object.entries(def.fields)) {
    if (fd.kind !== "text" && fd.kind !== "textarea") continue
    const v = item[k]
    const s = typeof v === "string" ? v : v && typeof v === "object" ? (v as Localized).en : ""
    if (s?.trim()) return s.replace(/\*([^*]+)\*/g, "$1").trim()
  }
  return ""
}

/** Tells the live preview which block is being edited (it scrolls there). */
const focusBlock = (path: string) => window.dispatchEvent(new CustomEvent("cms:focus-block", { detail: path }))

function BlockPicker({ blocks, onPick, onCancel }: { blocks: Record<string, BlockDef>; onPick: (type: string) => void; onCancel: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[13px] font-medium">Add a block</p>
        <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-foreground">
          Cancel
        </button>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {Object.entries(blocks).map(([type, def]) => (
          <button key={type} type="button" onClick={() => onPick(type)} className="flex items-start gap-3 rounded-xl p-2.5 text-start hover:bg-zinc-50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
              <BlockIcon name={def.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{def.label}</span>
              {def.help && <span className="block text-xs text-zinc-500">{def.help}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BlocksEditor({ name, field: fd, value, onChange, ctx }: { name: string; field: BlocksField; value: V[]; onChange: (v: V[]) => void; ctx: FormCtx }) {
  const ro = ctx.readOnly
  const items = value as Record<string, V>[]
  const keys = items.map((b, i) => (typeof b?._key === "string" && b._key) || `i${i}`)
  const [open, setOpen] = useState<Set<string>>(new Set())
  // Where the block picker is open: the index a new block goes in, or null.
  const [picker, setPicker] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const dndId = useId()
  useReveal(name, (i) => keys[i] && setOpen((o) => new Set([...o, keys[i]])))
  const atMax = fd.max !== undefined && items.length >= fd.max

  const toggle = (i: number) => {
    const n = new Set(open)
    if (n.has(keys[i])) n.delete(keys[i])
    else {
      n.add(keys[i])
      focusBlock(`${name}.${i}`)
    }
    setOpen(n)
  }
  const add = (type: string, at: number) => {
    const def = fd.blocks[type]
    const item = { ...emptyObject(def.fields), ...localizeObject(def.fields, structuredClone(def.starter ?? {})), _type: type, _key: newBlockKey() }
    onChange([...items.slice(0, at), item, ...items.slice(at)])
    setOpen((o) => new Set([...o, item._key]))
    setPicker(null)
    // Once the preview has the new block (after the autosave), show it there.
    setTimeout(() => focusBlock(`${name}.${at}`), 2500)
  }
  const duplicate = (i: number) => onChange([...items.slice(0, i + 1), { ...structuredClone(items[i]), _key: newBlockKey() }, ...items.slice(i + 1)])
  const remove = (i: number) => {
    if (!confirm("Remove this block? Until you publish, you can get it back from History.")) return
    onChange(items.filter((_, j) => j !== i))
  }
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    onChange(arrayMove(items, keys.indexOf(String(e.active.id)), keys.indexOf(String(e.over.id))))
  }

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <div>
          <span className="text-[13px] font-medium">{fd.label}</span> <span className="text-xs text-zinc-400">{items.length}</span>
          {fd.help && <p className="mt-0.5 text-xs text-zinc-500">{fd.help}</p>}
        </div>
        {items.length > 1 && (
          <button type="button" onClick={() => setOpen(open.size ? new Set() : new Set(keys))} className="text-[11px] text-zinc-500 hover:text-foreground">
            {open.size ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      {!items.length && picker === null && <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">No blocks yet. Add the first one: a Hero is a good start.</p>}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div>
            {items.map((item, i) => {
              const def = typeof item?._type === "string" ? fd.blocks[item._type] : undefined
              const isOpen = open.has(keys[i])
              return (
                <SortableRow key={keys[i]} id={keys[i]} disabled={ro}>
                  {(handle) => (
                    <div>
                      <div className={cn("rounded-xl border bg-white", isOpen ? "border-zinc-300 shadow-sm" : "border-zinc-200")} data-field={`${name}.${i}`}>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          {handle}
                          <button type="button" onClick={() => toggle(i)} className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-start text-sm">
                            <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform", !isOpen && "-rotate-90")} />
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                              <BlockIcon name={def?.icon} className="h-3.5 w-3.5" />
                            </span>
                            <span className="shrink-0 font-medium">{def?.label ?? "Unknown block"}</span>
                            {def && <span className="truncate text-zinc-500">{blockSummary(def, item)}</span>}
                          </button>
                          {!ro && (
                            <>
                              {!atMax && def && (
                                <button type="button" onClick={() => duplicate(i)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-foreground" aria-label="Duplicate block" title="Duplicate">
                                  <Copy className="h-4 w-4" />
                                </button>
                              )}
                              <button type="button" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove block" title="Remove">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                        {isOpen && (
                          <div className="border-t border-zinc-100 p-4">
                            {def ? (
                              <>
                                {def.help && <p className="mb-4 text-xs text-zinc-500">{def.help}</p>}
                                <FieldsForm fields={def.fields} value={item} onChange={(x) => onChange(items.map((y, j) => (j === i ? { ...x, _type: item._type, _key: item._key } : y)))} ctx={ctx} path={`${name}.${i}`} />
                              </>
                            ) : (
                              <p className="text-sm text-zinc-500">This kind of block (“{String(item?._type)}”) no longer exists, so the site skips it. Remove it.</p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Between blocks: a small "Add here" that shows on hover. */}
                      {!ro && !atMax && i < items.length - 1 && (
                        <div className="group relative h-3">
                          {picker !== i + 1 && (
                            <button type="button" onClick={() => setPicker(i + 1)} className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-600 shadow-sm hover:border-foreground hover:text-foreground group-hover:flex focus-visible:flex" aria-label="Add a block here">
                              <Plus className="h-3 w-3" /> Add here
                            </button>
                          )}
                        </div>
                      )}
                      {picker === i + 1 && i < items.length - 1 && (
                        <div className="mb-3">
                          <BlockPicker blocks={fd.blocks} onPick={(type) => add(type, i + 1)} onCancel={() => setPicker(null)} />
                        </div>
                      )}
                    </div>
                  )}
                </SortableRow>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      {!ro && !atMax && (
        <div className="mt-3">
          {picker === items.length ? (
            <BlockPicker blocks={fd.blocks} onPick={(type) => add(type, items.length)} onCancel={() => setPicker(null)} />
          ) : (
            <button type="button" onClick={() => setPicker(items.length)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> Add a block
            </button>
          )}
        </div>
      )}
    </div>
  )
}
