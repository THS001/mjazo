import "server-only"
import { NextResponse } from "next/server"
import { core, requireCore } from "@/lib/core/db"
import { customerForPhone } from "@/lib/core/customers"
import { CODE_MINUTES, CodeError, codesReady, dropCode, newCode, RESEND_SECONDS, useCode, type Channel } from "@/lib/core/phone-sign-in"
import { proEnabled, signPayload } from "./session"

// Phone-number sign-in for customers: sending the code, checking it, and the sign-in it gives.
// The code goes by:
// - WhatsApp: the Cloud API settings plus WHATSAPP_OTP_TEMPLATE, an "Authentication" template made
//   in Meta (WhatsApp Manager → Message templates) with a "Copy code" button. Its languages are in
//   WHATSAPP_OTP_LANGS (default "en"; e.g. "en,ur");
// - SMS through Twilio Verify: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SID (a
//   Verify service). Twilio makes and checks the code.
// Locally with neither, the code is shown on the screen ("test"). In production with neither,
// phone sign-in isn't offered. A right code gives a signed token ("mjs.", SESSION_SECRET) for 90
// days, sent as "Authorization: Bearer" like the emailed sign-in's (lib/server/customer-auth.ts).

export const PHONE_TOKEN = "mjs."
const SESSION_DAYS = 90

export type PhoneSession = { kind: "customer-phone"; customerId: string; phone: string; se: number }

export function phoneChannels() {
  const whatsapp = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE)
  const sms = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SID)
  return { whatsapp, sms, test: !whatsapp && !sms && process.env.NODE_ENV !== "production" }
}

/** How codes can go, from the settings alone (null: phone sign-in is off). For pages, which may be built ahead. */
export function phoneOffer() {
  const c = phoneChannels()
  return (c.whatsapp || c.sms || c.test) && proEnabled() ? c : null
}

/** What the sign-in screens offer: how codes can go, or null when phone sign-in is off here (or migration 0012 hasn't run). */
export async function phoneSignIn() {
  const c = phoneOffer()
  if (!c) return null
  const db = await core().catch(() => null)
  return db && (await codesReady(db).catch(() => false)) ? c : null
}

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"}`

async function sendWhatsApp(phone: string, code: string, lang: string) {
  const langs = (process.env.WHATSAPP_OTP_LANGS || "en").split(",").map((l) => l.trim()).filter(Boolean)
  const res = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `92${phone.slice(1)}`,
      type: "template",
      template: {
        name: process.env.WHATSAPP_OTP_TEMPLATE,
        language: { code: langs.includes(lang) ? lang : (langs[0] ?? "en") },
        // An authentication template takes the code in its text and in its copy-code button.
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  })
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? `WhatsApp ${res.status}`)
}

const twilio = (path: string, form: Record<string, string>) =>
  fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SID}/${path}`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  })

async function sendSms(phone: string) {
  const res = await twilio("Verifications", { To: `+92${phone.slice(1)}`, Channel: "sms" })
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? `Twilio ${res.status}`)
}

/** Twilio Verify's answer for an SMS code (404: it expired or was used already). */
async function checkSms(phone: string, code: string) {
  const res = await twilio("VerificationCheck", { To: `+92${phone.slice(1)}`, Code: code })
  if (res.status === 404) return false
  const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string }
  if (!res.ok) throw new Error(data.message ?? `Twilio ${res.status}`)
  return data.status === "approved"
}

/** Sends a code to the number: WhatsApp unless they asked for SMS (or only one is set up). */
export async function sendPhoneCode(p: { phone: string; via?: "whatsapp" | "sms"; lang?: string; ip?: string | null }) {
  const on = await phoneSignIn()
  if (!on) throw new CodeError("Sign-in with your number isn't available yet. Use your email.", "off")
  const via: Channel = on.test ? "test" : (p.via === "sms" && on.sms) || !on.whatsapp ? "sms" : "whatsapp"
  const db = await requireCore()
  const c = await newCode(db, { phone: p.phone, channel: via, ip: p.ip })
  try {
    if (via === "whatsapp") await sendWhatsApp(c.phone, c.code!, p.lang === "ur" ? "ur" : "en")
    else if (via === "sms") await sendSms(c.phone)
    else console.info(`[phone sign-in] test code for ${c.phone}: ${c.code}`)
  } catch (e) {
    await dropCode(db, c.id)
    console.error(`[phone sign-in] couldn't send by ${via}`, e)
    throw new CodeError(via === "whatsapp" && on.sms ? "We couldn't send it on WhatsApp. Try SMS instead." : "We couldn't send the code. Try again in a minute.", "send")
  }
  return { via, expiresIn: CODE_MINUTES * 60, resendIn: RESEND_SECONDS, ...(via === "test" ? { testCode: c.code! } : {}) }
}

/** A CodeError as the API answers it: the message, its code (the screens word it in their own language) and, for "wait", the seconds left. */
export const codeErrorResponse = (e: CodeError) =>
  NextResponse.json({ error: e.message, code: e.code, ...(e.retryIn ? { retryIn: e.retryIn } : {}) }, { status: e.code === "wait" || e.code === "limit" ? 429 : e.code === "off" ? 403 : 400 })

/** Checks a code; the number comes back once it's proven (the code is used up). */
export async function proveNumber(phone: string, code: string) {
  if (!(await phoneSignIn())) throw new CodeError("Sign-in with your number isn't available yet. Use your email.", "off")
  return useCode(await requireCore(), { phone, code, external: checkSms })
}

/** Signs in with a code: the customer that number belongs to (new if we haven't seen it), and their token. */
export async function signInWithPhone(p: { phone: string; code: string }) {
  const phone = await proveNumber(p.phone, p.code)
  const { customer, isNew, epoch } = await customerForPhone(await requireCore(), phone)
  const session: PhoneSession = { kind: "customer-phone", customerId: customer.id, phone, se: epoch }
  return {
    token: PHONE_TOKEN + signPayload(session, SESSION_DAYS * 86400),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(),
    customer,
    isNew,
  }
}
