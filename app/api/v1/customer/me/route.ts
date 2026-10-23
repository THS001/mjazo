import { z } from "zod"
import { core } from "@/lib/core/db"
import { readJson } from "@/lib/server/api"
import { customerMe, saveCustomer } from "@/lib/server/customer-api"
import { accountCustomer, asAccount, asCustomer } from "@/lib/server/customer-auth"

// Who's signed in: the account's email, their customer record (null until an emailed sign-in adds
// its phone number: POST me/link) and their wallet credit. PATCH changes their name, language or
// messages.

export const GET = asAccount(async (account) => customerMe(account, await accountCustomer((await core())!, account)))

const patch = z.object({ name: z.string().trim().min(2).max(80).optional(), lang: z.enum(["en", "ur"]).optional(), marketingOk: z.boolean().optional() })

export const PATCH = asCustomer(async ({ customer }, req) => ({ customer: await saveCustomer(customer, patch.parse(await readJson(req))) }))
