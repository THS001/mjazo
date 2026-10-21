import { API_URL } from "./config"

// Every call to the Mjazo API (/api/v1, plus /api/rate). JSON in and out; a session token goes as
// "Authorization: Bearer …". A refused call throws ApiError with the server's message, which the
// screens show as it is (code "offline" when the phone couldn't reach the server at all).

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly data?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export type RequestOptions = { method?: string; body?: unknown; token?: string | null }

export async function request<T = Record<string, unknown>>(path: string, o: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: o.method ?? (o.body === undefined ? "GET" : "POST"),
      headers: {
        accept: "application/json",
        ...(o.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    })
  } catch {
    throw new ApiError("No connection. Check your internet and try again.", 0, "offline")
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : `Something went wrong (${res.status})`, res.status, typeof data.code === "string" ? data.code : undefined, data)
  return data as T
}

/** What to show for a failed call: the server's reason, or the "no connection" line in the app's language. */
export const errorText = (e: unknown, offline: string) => (e instanceof ApiError ? (e.code === "offline" ? offline : e.message) : e instanceof Error ? e.message : String(e))
