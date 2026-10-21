import { proRatingSummary } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// Her rating: the average, how the stars are spread, and recent ratings (no customer names).

export const GET = asPro(async (pro) => proRatingSummary(pro))
