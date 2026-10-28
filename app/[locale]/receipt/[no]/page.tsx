import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Container } from "@/components/site/primitives"
import { PrintButton } from "@/components/site/print-button"
import { formatAmount, formatPKR } from "@/lib/catalog"
import { pageLocale } from "@/lib/cms/locale"
import { getUi } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"
import { fill } from "@/lib/cms/format"
import { taxPct } from "@/lib/ops/policy"
import { receiptDue } from "@/lib/receipts"
import { receiptForLink } from "@/lib/server/receipts"
import { formatBookingDate, windowLabel } from "@/lib/time"

// A receipt (/receipt/MJR-000123?k=…): the link is signed, so it opens from WhatsApp or an email
// without signing in. Never indexed. Prints cleanly (the site's header and footer are hidden).

type Props = { params: Promise<{ locale: string; no: string }>; searchParams: Promise<{ k?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await pageLocale(params)
  const { no } = await params
  const ui = await getUi()
  return pageMetadata({ path: `/receipt/${no}`, title: fill(ui.receipt.number, { no }), description: ui.receipt.thanks, noindex: true })
}

const METHODS: Record<string, string> = { jazzcash: "JazzCash", easypaisa: "Easypaisa", raast: "Raast" }

export default async function ReceiptPage({ params, searchParams }: Props) {
  const locale = await pageLocale(params)
  const { no } = await params
  const { k } = await searchParams
  const page = await receiptForLink(decodeURIComponent(no), k)
  if (!page) notFound()
  const t = (await getUi()).receipt
  const { receipt: r, area, payment, refunded } = page
  const d = r.data
  const sep = locale === "ur" ? "، " : ", "
  const issued = new Date(r.issuedAt).toLocaleString(locale === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })
  const discountLabel = d.discounts.length > 1 ? t.discounts : d.discounts[0] === "promo" ? fill(t.promo, { code: d.promo ?? "" }) : d.discounts[0] === "plus" ? t.plus : d.discounts[0] === "referral" ? t.referral : d.discounts[0] === "pack" ? t.pack : t.discounts
  const due = receiptDue(d)
  const Row = ({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) => (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""} ${muted ? "text-zinc-500" : ""}`}>
      <span>{k}</span>
      <span dir="ltr" className="tabular-nums whitespace-nowrap">{v}</span>
    </div>
  )

  return (
    <section className="pt-32 pb-24 print:pt-0 print:pb-0">
      <style>{"@media print { header, footer, nav, .fixed { display: none !important } body { background: #fff !important } }"}</style>
      <Container className="max-w-2xl">
        <article className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-10 print:border-0 print:p-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-serif text-4xl">Mjazo</p>
              <p className="text-xs text-zinc-500 mt-1">Ghar ka har kaam. Pakka.</p>
            </div>
            <div className="text-end">
              <p className="text-sm font-semibold">{fill(t.number, { no: r.number })}</p>
              <p className="text-xs text-zinc-500 mt-1">{fill(t.issued, { date: issued })}</p>
              <p className="text-xs text-zinc-500">{fill(t.booking, { id: d.bookingId })}</p>
            </div>
          </div>

          <div className="mt-8 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">{t.forName}</p>
              <p className="font-medium">{d.customer.name}</p>
              <p className="text-zinc-600">{[d.customer.subArea, area].filter(Boolean).join(sep)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">{t.visit}</p>
              <p className="font-medium">
                {formatBookingDate(d.date, locale)} · {windowLabel(d.window, locale)}
              </p>
              {d.pro && (
                <p className="text-zinc-600">
                  {t.pro}: {d.pro}
                </p>
              )}
            </div>
          </div>

          <ul className="mt-8 divide-y divide-zinc-100 border-y border-zinc-100 text-sm">
            {d.lines.map((l, i) => (
              <li key={i} className="py-3 flex justify-between gap-4">
                <span>
                  <span className="font-medium">
                    {l.name}
                    {l.qty > 1 ? ` ×${l.qty}` : ""}
                  </span>
                  {(l.options.length > 0 || l.addOns.length > 0) && <span className="block text-xs text-zinc-500 mt-0.5">{[...l.options, ...l.addOns].join(sep)}</span>}
                </span>
                <span dir="ltr" className="tabular-nums whitespace-nowrap">{formatPKR(l.unitPrice * l.qty)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2 text-sm">
            <Row k={t.services} v={formatAmount(d.subtotal)} />
            {d.discount > 0 && <Row k={discountLabel} v={`− ${formatPKR(d.discount)}`} />}
            {d.tax && !d.tax.inclusive && <Row k={fill(t.taxAdded, { rate: taxPct(d.tax.rate) })} v={formatPKR(d.tax.amount)} />}
            <Row k={t.total} v={formatAmount(d.total)} strong />
            {d.tax?.inclusive && <p className="text-xs text-zinc-500">{fill(d.tax.base === "total" ? t.taxIncluded : t.taxOnFee, { rate: taxPct(d.tax.rate), amount: formatPKR(d.tax.amount) })}</p>}
            {d.pack && <Row k={fill(t.fromPack, { name: d.pack.name })} v={`− ${formatPKR(d.pack.paid)}`} muted />}
            {d.credit > 0 && <Row k={t.credit} v={`− ${formatPKR(d.credit)}`} muted />}
            {(d.pack || d.credit > 0) && <Row k={t.paidAfter} v={formatAmount(due)} />}
            <p className="text-xs text-zinc-500 pt-2">{payment ? fill(t.paidBy, { method: payment.method === "cash" ? t.cash : (METHODS[payment.method] ?? payment.method) }) : due > 0 ? t.notRecorded : ""}</p>
            {refunded > 0 && <p className="text-sm font-medium text-emerald-700">{fill(t.refunded, { amount: formatPKR(refunded) })}</p>}
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
            <p>{t.thanks}</p>
            {d.registration && <p>{fill(t.registration, { no: d.registration })}</p>}
          </div>
        </article>
        <div className="mt-6 flex justify-center">
          <PrintButton label={t.print} />
        </div>
      </Container>
    </section>
  )
}
