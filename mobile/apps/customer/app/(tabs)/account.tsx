import { Button, Card, color, fill, formatPKR, Loading, prefs, Row, Screen, SITE_URL, space, Switch, Txt, whatsappLink } from "@mjazo/shared"
import Constants from "expo-constants"
import { router } from "expo-router"
import { ChevronRight, MapPin, MessageCircle, Wallet } from "lucide-react-native"
import { useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { LangSwitch } from "../../src/parts"
import { useAccount, useCatalog, useT } from "../../src/state"

// Account: sign in (or finish with the phone number), credit, saved addresses, the messages
// switch, language, help and sign out.

export default function Account() {
  const t = useT()
  const { account, api, refresh, signOut } = useAccount()
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
  const out = async () => {
    // This phone stops getting their booking updates.
    const token = await prefs.get<string | null>("mjazo.push", null)
    if (token) await api("/api/v1/customer/push-token", { method: "DELETE", body: { token } }).catch(() => {})
    await prefs.remove("mjazo.push")
    await signOut()
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
      {account.state !== "out" && <Button title={t.signOut} variant="light" onPress={out} />}
      {me && <Txt v="muted">{fill(t.signedInAs, { email: me.email })}</Txt>}
      <Txt v="muted" style={{ marginTop: space.md }}>
        {fill(t.version, { v: Constants.expoConfig?.version ?? "1.0.0" })}
      </Txt>
    </Screen>
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
