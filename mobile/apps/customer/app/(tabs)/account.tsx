import { Button, Card, color, errorText, Field, fill, formatDay, formatPKR, karachiNow, Loading, Notice, prefs, Row, Screen, SITE_URL, space, Switch, Txt, useLang, whatsappLink } from "@mjazo/shared"
import Constants from "expo-constants"
import { router } from "expo-router"
import { ChevronRight, Crown, Gift, MapPin, MessageCircle, Share2, Wallet } from "lucide-react-native"
import { useState } from "react"
import { Linking, Pressable, Share, View } from "react-native"
import { LangSwitch } from "../../src/parts"
import { useAccount, useCatalog, useT } from "../../src/state"

// Account: sign in (or finish with the phone number), credit, saved addresses, the messages
// switch, language, help and sign out.

export default function Account() {
  const t = useT()
  const { account, api, refresh, signOut, signOutEverywhere } = useAccount()
  const { catalog } = useCatalog()
  const [busy, setBusy] = useState(false)
  const whatsapp = catalog?.contact.whatsapp

  if (account.state === "loading") return <Loading />
  const me = account.state === "in" ? account.me : null

  const setMessages = async (on: boolean) => {
    setBusy(true)
    try {
      await api("/api/v1/customer/me", { method: "PATCH", body: { marketingOk: on } })
      await refresh()
    } catch {}
    setBusy(false)
  }
  const out = async (everywhere = false) => {
    // This phone stops getting their booking updates.
    const token = await prefs.get<string | null>("mjazo.push", null)
    if (token) await api("/api/v1/customer/push-token", { method: "DELETE", body: { token } }).catch(() => {})
    await prefs.remove("mjazo.push")
    await (everywhere ? signOutEverywhere() : signOut())
  }

  return (
    <Screen top>
      <Txt v="title">{t.account}</Txt>
      {account.state === "out" && (
        <Card>
          <Txt v="h3">{t.signInTitle}</Txt>
          <Txt v="muted">{t.signInToSee}</Txt>
          <Button title={t.signIn} onPress={() => router.push("/login")} />
        </Card>
      )}
      {account.state === "phone" && (
        <Card>
          <Txt v="h3">{t.phoneTitle}</Txt>
          <Txt v="muted">{t.phoneSub}</Txt>
          <Button title={t.continue} onPress={() => router.push("/phone")} />
        </Card>
      )}
      {me && (
        <>
          <Card>
            <Txt v="h3">{me.customer.name}</Txt>
            <Txt v="muted">{[me.customer.phone, me.email].filter(Boolean).join(" · ")}</Txt>
          </Card>
          <Item icon={<Wallet size={20} color={color.ink} />} title={t.credit} sub={me.credit.available > 0 ? fill(t.creditSub, { amount: formatPKR(me.credit.available) }) : t.noCredit} />
          <Item icon={<MapPin size={20} color={color.ink} />} title={t.addresses} onPress={() => router.push("/addresses")} />
          <PlusCard />
          <ReferCard />
          <GiftCard />
          <Card>
            <Row style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt v="h3">{t.messagesTitle}</Txt>
                <Txt v="muted">{t.messagesSub}</Txt>
              </View>
              <Switch on={me.customer.marketingOk} busy={busy} onChange={setMessages} label={t.messagesTitle} />
            </Row>
          </Card>
        </>
      )}
      <Card>
        <Txt v="h3">{t.language}</Txt>
        <LangSwitch />
      </Card>
      {whatsapp && <Item icon={<MessageCircle size={20} color={color.ink} />} title={t.support} sub={t.supportSub} onPress={() => void Linking.openURL(whatsappLink(whatsapp))} />}
      <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/legal/terms`)}>
        <Txt v="small" style={{ textDecorationLine: "underline" }}>
          {t.terms}
        </Txt>
      </Pressable>
      {account.state !== "out" && <Button title={t.signOut} variant="light" onPress={() => void out()} />}
      {me && <Button title={t.signOutAll} variant="ghost" small onPress={() => void out(true)} />}
      {me?.by === "phone" && me.customer.phone ? <Txt v="muted">{fill(t.signedInPhone, { phone: me.customer.phone })}</Txt> : me?.email ? <Txt v="muted">{fill(t.signedInAs, { email: me.email })}</Txt> : null}
      <Txt v="muted" style={{ marginTop: space.md }}>
        {fill(t.version, { v: Constants.expoConfig?.version ?? "1.0.0" })}
      </Txt>
    </Screen>
  )
}

/** Mjazo Plus: their membership, the request waiting for its fee, or joining. */
function PlusCard() {
  const t = useT()
  const { lang } = useLang()
  const { account, api, refresh } = useAccount()
  const { catalog } = useCatalog()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (account.state !== "in") return null
  const p = account.me.plus
  const join = async () => {
    setBusy(true)
    setError("")
    try {
      await api("/api/v1/customer/plus", { body: {} })
      await refresh()
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card tint={p?.status === "active" ? color.brandSoft : undefined}>
      <Row>
        <Crown size={20} color={color.ink} />
        <Txt v="h3">{t.plus}</Txt>
      </Row>
      {p?.status === "active" && p.endsAt ? (
        <Txt>{fill(t.plusActive, { date: formatDay(karachiNow(new Date(p.endsAt)).date, lang), pct: p.discountPct })}</Txt>
      ) : p?.status === "requested" ? (
        <Txt v="muted">{fill(t.plusWaiting, { price: formatPKR(p.price) })}</Txt>
      ) : (
        <>
          {catalog && <Txt v="muted">{fill(t.plusJoinSub, { price: formatPKR(catalog.plus.price), pct: catalog.plus.discountPct })}</Txt>}
          <Button title={t.plusJoin} variant="brand" busy={busy} onPress={join} />
        </>
      )}
      {error ? <Notice text={error} /> : null}
    </Card>
  )
}

/** Their referral code, what it gives and has earned, shared through the phone's share sheet. */
function ReferCard() {
  const t = useT()
  const { account } = useAccount()
  if (account.state !== "in" || !account.me.referral) return null
  const r = account.me.referral
  const share = () => void Share.share({ message: fill(t.referShare, { code: r.code, amount: formatPKR(r.friendOff), link: `${SITE_URL}/?ref=${r.code}` }) })
  return (
    <Card>
      <Txt v="tiny">{t.referTitle}</Txt>
      <Txt v="title" selectable>
        {r.code}
      </Txt>
      <Txt v="muted">{fill(t.referSub, { friendOff: formatPKR(r.friendOff), youGet: formatPKR(r.youGet) })}</Txt>
      {r.friends > 0 && <Txt v="small" style={{ fontWeight: "600" }}>{fill(t.referEarned, { count: r.friends, amount: formatPKR(r.earned) })}</Txt>}
      <Button title={t.share} variant="whatsapp" icon={<Share2 size={16} color={color.paper} />} onPress={share} />
    </Card>
  )
}

/** A gift card's code, turned into their credit. */
function GiftCard() {
  const t = useT()
  const { api, refresh } = useAccount()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null)
  const add = async () => {
    if (!code.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await api<{ added: number }>("/api/v1/customer/gift-card", { body: { code } })
      setMsg({ text: fill(t.giftAdded, { amount: formatPKR(r.added) }), tone: "green" })
      setCode("")
      await refresh()
    } catch (e) {
      setMsg({ text: errorText(e, t.offline), tone: "red" })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <Row>
        <Gift size={20} color={color.ink} />
        <Txt v="h3">{t.giftTitle}</Txt>
      </Row>
      <Txt v="muted">{t.giftSub}</Txt>
      <Field value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="MJG-XXXX-XXXX" autoCapitalize="none" maxLength={20} />
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Button title={t.giftAdd} busy={busy} disabled={!code.trim()} onPress={add} />
    </Card>
  )
}

function Item({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub?: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress}>
      <Row gap={space.md}>
        {icon}
        <View style={{ flex: 1 }}>
          <Txt v="h3">{title}</Txt>
          {sub ? <Txt v="muted">{sub}</Txt> : null}
        </View>
        {onPress ? <ChevronRight size={18} color={color.faint} /> : null}
      </Row>
    </Card>
  )
}
