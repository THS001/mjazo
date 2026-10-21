import { proOffers } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// Visits offered to her (the last week), open ones first. Before she accepts: where and what, and
// what she'd earn; who the customer is comes with the visit once it's hers.

export const GET = asPro(async (pro) => proOffers(pro))
