import { joinPlus } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// They ask to join Mjazo Plus. Ops are told, take the fee (JazzCash, Easypaisa, bank or cash) and
// activate it in mission control; from then on every booking gets the member's discount for a year.

export const POST = asCustomer(async ({ customer }) => ({ plus: await joinPlus(customer) }))
