import { clearSession } from "@/lib/server/session"
import { handle } from "@/lib/server/api"

export const POST = () => handle(async () => void (await clearSession()))
