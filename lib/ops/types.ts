// Shared ops types (used by the server, the ops console and the pro app).

export type JobStatus = "new" | "assigned" | "en_route" | "checked_in" | "checked_out" | "completed" | "cancelled"
export type JobEventType = "assigned" | "en_route" | "checked_in" | "checked_out" | "completed" | "cancelled" | "safe" | "sos" | "alert_ping" | "alert_escalated" | "note" | "payment"
export type JobEvent = { type: JobEventType; at: string; by: "ops" | "pro" | "system"; note?: string; lat?: number; lng?: number }

export type PaymentRecord = {
  amount: number
  method: "cash" | "jazzcash" | "easypaisa" | "raast"
  at: string
  screenshot?: string // small data URL, digital payments only
  ocr?: { amount?: number; reference?: string; date?: string; payer?: string; confidence?: string }
  status: "cash" | "matched" | "mismatch" | "unreadable" | "pending"
  checked?: boolean // a person at ops has confirmed it
  note?: string
}

export type JobItem = { name: string; category: string; service: string; options: string[]; addOns: string[]; qty: number; unitPrice: number }

export type Job = {
  id: string // = booking id
  createdAt: string
  date: string
  window: string
  area: string
  subArea?: string
  address: string
  landmark?: string
  customer: { name: string; phone: string }
  items: JobItem[]
  total: number
  payment: string
  notes?: string
  channel?: string
  status: JobStatus
  proId?: string
  routeOrder?: number
  eta?: string // "HH:MM"
  events: JobEvent[]
  paymentRecord?: PaymentRecord
  visitNotes?: string[]
  brief?: JobBrief // Ghar Scan diagnosis or Glam Mirror Look Card sent with the booking
  rating?: Rating
  event?: { planId: string; name: string; readyBy: string; track: string; people: { name: string; start: string; end: string; services: string[] }[] } // Shaadi Orchestrator
}

export type BriefPin = { photo: number; x: number; y: number; label: string }
export type JobBrief = { kind: "scan" | "look"; title: string; text: string; causes?: string[]; parts?: string[]; pins?: BriefPin[]; hasPhotos?: boolean }

export const RATING_TAGS = {
  good: ["On time", "Friendly", "Clean & hygienic", "Great result", "The look matched"],
  bad: ["Late", "Rushed", "Messy", "Price changed", "Not what I asked for"],
} as const
export type Rating = { stars: number; tags: string[]; comment?: string; at: string }

export type Pro = {
  id: string
  name: string
  phone: string
  area: string
  skills: string[] // category slugs the pro can serve
  women: boolean
  status: "active" | "paused"
  pinHash?: string
  createdAt: string
  applicationId?: string
}

export type InterviewTurn = { role: "user" | "assistant"; text: string }
export type Scores = { experience: number; skills: number; hygiene: number; availability: number; transport: number; communication: number }

export type Application = {
  id: string
  createdAt: string
  name: string
  phone: string
  area: string
  skills: string[]
  experience: string
  availability: string[]
  transport: string
  portfolio?: string
  lang: string
  status: "new" | "interviewing" | "interviewed" | "test_booked" | "hired" | "declined"
  token: string
  interview?: InterviewTurn[]
  scores?: Scores
  summary?: string
  strengths?: string[]
  concerns?: string[]
  testSlot?: string
  decisionNote?: string
  proId?: string
}

export type Complaint = {
  id: string
  createdAt: string
  bookingId: string
  phone: string
  text: string
  photo?: string
  audio?: string // voice note (data URL)
  transcript?: string
  status: "new" | "draft_ready" | "resolved"
  draft?: { resolution: "redo" | "partial_refund" | "full_refund" | "apology" | "investigate"; message: string; reasoning: string; refundPKR?: number }
  resolution?: string
  resolvedAt?: string
}

export type SafetyLevel = "ok" | "late" | "overdue" | "escalated" | "sos"
export type SafetyStatus = { level: SafetyLevel; message: string; minutes?: number }
