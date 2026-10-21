import { readJson } from "@/lib/server/api"
import { addressBody, customerAddresses, saveCustomerAddress } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// Their saved addresses (with a map pin and the area it falls in), and adding one.

export const GET = asCustomer(async ({ customer }) => ({ addresses: await customerAddresses(customer) }))

export const POST = asCustomer(async ({ customer }, req) => ({ address: await saveCustomerAddress(customer, addressBody.parse(await readJson(req))) }))
