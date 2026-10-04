"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ExternalLink, GripVertical, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPKR } from "@/lib/catalog"
import type { TypeMeta } from "@/lib/cms/meta"
import type { ListItem, State } from "@/lib/cms/write"
import { reorderAction } from "@/app/(staff)/admin/actions"
import { AdminIcon, Btn, Card, Notice, StateBadge, ago } from "./ui"

const FILTERS: { id: "all" | State | "review"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "changed", label: "Unpublished changes" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "review", label: "In review" },
  { id: "hidden", label: "Hidden" },
]

export function CollectionList({ meta, items: initial, refs, canCreate, canReorder }: { meta: TypeMeta; items: ListItem[]; refs: Record<string, { id: string; title: string }[]>; canCreate: boolean; canReorder: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [error, setError] = useState("")
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((i) => {
      if (filter === "review" ? !i.review : filter !== "all" && (filter === "changed" ? i.state !== "changed" : i.state !== filter)) return false
      if (filter === "all" && i.state === "hidden" && !needle) return true
      return !needle || i.title.toLowerCase().includes(needle) || i.id.includes(needle)
    })
  }, [items, q, filter])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, f.id === "all" ? items.length : f.id === "review" ? items.filter((i) => i.review).length : items.filter((i) => i.state === f.id).length])), [items])
  const reorderable = canReorder && filter === "all" && !q

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((i) => i.id === e.active.id)
    const to = items.findIndex((i) => i.id === e.over!.id)
    const next = arrayMove(items, from, to)
    setItems(next)
    const r = await reorderAction(meta.type, next.map((i) => i.id))
    if (!r.ok) {
      setError(r.error)
      setItems(items)
    } else router.refresh()
  }

  const cell = (item: ListItem, c: TypeMeta["columns"][number]) => {
    const v = item.cols[c.key]
    if (c.format === "price") return <span className="tabular-nums">{formatPKR(Number(v ?? 0))}</span>
    if (c.format === "status") return <span className={cn("capitalize", v === "live" ? "text-emerald-700" : "text-zinc-500")}>{String(v ?? "")}</span>
    if (c.format === "ref") {
      const field = meta.fields[c.key]
      const to = field?.kind === "ref" ? field.to : ""
      return refs[to]?.find((o) => o.id === v)?.title ?? String(v ?? "")
    }
    return String(v ?? "")
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">{meta.group}</p>
          <h1 className="mt-1 flex items-center gap-2 font-serif text-3xl">
            <AdminIcon name={meta.icon} className="w-6 h-6 text-zinc-400" /> {meta.plural}
          </h1>
          {meta.description && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{meta.description}</p>}
        </div>
        {canCreate && (
          <Link href={`/admin/c/${meta.type}/new`}>
            <Btn variant="primary">
              <Plus className="w-4 h-4" /> New {meta.label.toLowerCase()}
            </Btn>
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${meta.plural.toLowerCase()}`} className="h-10 w-full rounded-full border border-zinc-300 bg-white pl-9 pr-4 text-sm outline-none focus:border-foreground" />
        </div>
        {FILTERS.filter((f) => f.id === "all" || counts[f.id]).map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn("h-8 rounded-full px-3 text-xs", filter === f.id ? "bg-foreground text-background" : "bg-white border border-zinc-200 hover:border-zinc-400")}>
            {f.label} <span className="opacity-60">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {error && <Notice tone="error" className="mb-3">{error}</Notice>}

      <Card className="overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                {reorderable && <th className="w-8" />}
                <th className="px-4 py-2.5 font-medium">Name</th>
                {meta.columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Changed</th>
                <th className="w-10" />
              </tr>
            </thead>
              <SortableContext items={shown.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {shown.map((item) => (
                    <Row key={item.id} item={item} reorderable={reorderable}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/c/${meta.type}/${item.id}`} className="font-medium hover:underline">
                          {item.title}
                        </Link>
                        <p className="font-mono text-[11px] text-zinc-400">{item.id}</p>
                      </td>
                      {meta.columns.map((c) => (
                        <td key={c.key} className="px-4 py-2.5 text-zinc-600">
                          {cell(item, c)}
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <StateBadge state={item.state} review={item.review} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{item.updatedAt ? `${ago(item.updatedAt)}${item.updatedBy ? ` · ${item.updatedBy}` : ""}` : "Built-in"}</td>
                      <td className="px-2 py-2.5">
                        {item.path && item.state !== "hidden" && item.state !== "draft" && (
                          <a href={item.path} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-foreground" title="View on site">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </Row>
                  ))}
                </tbody>
              </SortableContext>
          </table>
        </div>
        </DndContext>
        {!shown.length && <p className="px-4 py-10 text-center text-sm text-zinc-500">Nothing matches.</p>}
      </Card>
      {reorderable && <p className="mt-2 text-xs text-zinc-400">Drag rows to change the order on the site. The new order goes live immediately.</p>}
    </div>
  )
}

function Row({ item, reorderable, children }: { item: ListItem; reorderable: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderable })
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn("border-t border-zinc-100 hover:bg-zinc-50/60", isDragging && "relative z-10 bg-white shadow-lg", item.state === "hidden" && "opacity-60")}>
      {reorderable && (
        <td className="pl-2">
          <button {...attributes} {...listeners} className="grid h-8 w-6 cursor-grab place-items-center text-zinc-300 hover:text-zinc-600" aria-label="Drag to reorder">
            <GripVertical className="w-4 h-4" />
          </button>
        </td>
      )}
      {children}
    </tr>
  )
}
