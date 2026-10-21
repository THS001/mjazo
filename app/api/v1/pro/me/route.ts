import { proProfile } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// The signed-in pro's profile: name, areas, skills, verification and rating.

export const GET = asPro(async (pro) => proProfile(pro))
