import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { askForPack, customerPacks } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// Visit packs: the packs on offer and theirs (GET ?lang=), and asking for one (POST { slug }). Ops
// are told, take the money (JazzCash, Easypaisa, bank, Raast or cash) and activate it in mission
// control; then each booking made with it (packId at checkout) is paid from the pack.

const lang = (req: Request) => (new URL(req.url).searchParams.get("lang") === "ur" ? "ur" : "en")

export const GET = asCustomer(async ({ customer }, req) => customerPacks(customer, lang(req)))

const body = z.object({ slug: z.string().max(80) })

export const POST = asCustomer(async ({ customer }, req) => askForPack(customer, body.parse(await readJson(req)).slug, lang(req)))
