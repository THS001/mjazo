import { endCustomerSessions } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// "Sign out everywhere": ends every phone sign-in of this customer, on every device (this one too).
// The website and the app sign their emailed sign-in out with Supabase themselves.

export const DELETE = asCustomer(async ({ customer }) => {
  await endCustomerSessions(customer)
  return { ok: true }
})
