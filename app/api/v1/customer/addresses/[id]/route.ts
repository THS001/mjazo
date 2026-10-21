import { readJson } from "@/lib/server/api"
import { addressBody, deleteCustomerAddress, saveCustomerAddress } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// Change or remove one of their saved addresses.

type Ctx = { params: Promise<{ id: string }> }

export const PUT = asCustomer<Ctx>(async ({ customer }, req, { params }) => ({ address: await saveCustomerAddress(customer, { ...addressBody.parse(await readJson(req)), id: (await params).id }) }))

export const DELETE = asCustomer<Ctx>(async ({ customer }, _req, { params }) => {
  await deleteCustomerAddress(customer, (await params).id)
  return { ok: true }
})
