import { proEarnings } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// What she's owed and the cash she holds (from the ledger), her earnings this week and month, her
// statement and her payouts.

export const GET = asPro(async (pro) => proEarnings(pro))
