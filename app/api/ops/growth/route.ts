import { z } from "zod"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { requireCore } from "@/lib/core/db"
import { activatePlus, cancelGiftCard, cancelPlus, issueGiftCard, listGiftCards, listPlus, listReferralRewards } from "@/lib/core/growth"
import { InputError } from "@/lib/core/errors"
import { activatePack, cancelPack, listPacks } from "@/lib/core/packs"
import { packOffers } from "@/lib/packs"
import { handle, readJson } from "@/lib/server/api"
import { kick } from "@/lib/server/kick"
import { requireStaff } from "@/lib/server/staff"

// Mission control → Plus & gifts (Finance and Owners: money comes in here). Plus requests waiting
// for their fee and the members; pack requests waiting for their money, adding a pack by phone, the
// packs in use and cancelling one; issuing a paid-for gift card (its code to send to the buyer) and
// cancelling an unused one; the referral rewards paid. Every action is in the ledger and the audit log.

const method = z.enum(["jazzcash", "easypaisa", "bank", "cash", "raast"])
const phone = z.string().max(20).optional()
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate_plus"), membershipId: z.string().optional(), phone, name: z.string().max(80).optional(), paidVia: method, reference: z.string().max(80).optional() }),
  z.object({ action: z.literal("cancel_plus"), membershipId: z.string(), note: z.string().max(300).optional() }),
  z.object({
    action: z.literal("issue_gift"),
    amount: z.number().int(),
    buyerName: z.string().max(80).optional(),
    buyerPhone: phone,
    recipientName: z.string().max(80).optional(),
    recipientPhone: phone,
    message: z.string().max(300).optional(),
    paidVia: method,
    reference: z.string().max(80).optional(),
  }),
  z.object({ action: z.literal("cancel_gift"), code: z.string().max(20), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("activate_pack"), packId: z.string().max(40).optional(), slug: z.string().max(80).optional(), phone, name: z.string().max(80).optional(), paidVia: method, reference: z.string().max(80).optional() }),
  z.object({ action: z.literal("cancel_pack"), packId: z.string().max(40), note: z.string().max(300).optional() }),
])

async function overview() {
  const db = await requireCore()
  // Until migration 0013 has run there are no packs, and the rest of the tab still works.
  const [plus, packs, gifts, rewards, s, cat] = await Promise.all([listPlus(db), listPacks(db).catch(() => []), listGiftCards(db), listReferralRewards(db), getSettings("en"), getCatalog("en")])
  const offers = packOffers(cat).map((o) => ({ slug: o.slug, name: o.name, visits: o.visits, visitPrice: o.visitPrice, listPrice: o.listPrice, total: o.total }))
  return { plus, packs, offers, gifts, rewards, terms: { price: s.plus.price, discountPct: Math.round(s.plus.discount * 100), friendOff: s.referral.friendOff, youGet: s.referral.youGet } }
}

export async function GET() {
  return handle(async () => {
    await requireStaff("ops.money")
    return overview()
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.money")
    const db = await requireCore()
    const b = body.parse(await readJson(req))
    let result: Record<string, unknown> = {}
    if (b.action === "activate_plus") {
      const s = await getSettings("en")
      result = { membership: await activatePlus(db, { membershipId: b.membershipId, phone: b.phone, name: b.name, terms: { price: s.plus.price, discountPct: Math.round(s.plus.discount * 100) }, paidVia: b.paidVia, reference: b.reference, by: me.email }) }
      kick() // the welcome message
    } else if (b.action === "cancel_plus") result = { membership: await cancelPlus(db, b.membershipId, me.email, b.note) }
    else if (b.action === "issue_gift") result = { gift: await issueGiftCard(db, { ...b, by: me.email }) }
    else if (b.action === "cancel_gift") result = { gift: await cancelGiftCard(db, b.code, me.email, b.reason) }
    else if (b.action === "activate_pack") {
      const offer = b.packId ? undefined : packOffers(await getCatalog("en")).find((o) => o.slug === b.slug)
      if (!b.packId && !offer) throw new InputError("Pick a pack")
      result = { pack: await activatePack(db, { packId: b.packId, phone: b.phone, name: b.name, offer, paidVia: b.paidVia, reference: b.reference, by: me.email }) }
      kick() // the welcome message
    } else result = { pack: await cancelPack(db, b.packId, me.email, b.note) }
    return { ...result, ...(await overview()) }
  })
}
