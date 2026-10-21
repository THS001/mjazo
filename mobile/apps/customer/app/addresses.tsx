import { Badge, Button, Card, confirm, Empty, errorText, Loading, Notice, Row, Screen, Txt, type Address } from "@mjazo/shared"
import { router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useAccount, useCatalog, useT } from "../src/state"

// Saved addresses: up to 10, one default (checkout picks it first).

export default function Addresses() {
  const t = useT()
  const { api } = useAccount()
  const { catalog } = useCatalog()
  const [list, setList] = useState<Address[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const load = useCallback(async () => {
    try {
      setList((await api<{ addresses: Address[] }>("/api/v1/customer/addresses")).addresses)
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  const remove = async (a: Address) => {
    if (!(await confirm(t.deleteAddress, a.line, t.delete, t.cancel, true))) return
    await api(`/api/v1/customer/addresses/${a.id}`, { method: "DELETE" }).catch((e) => setError(e))
    await load()
  }
  const makeDefault = async (a: Address) => {
    await api(`/api/v1/customer/addresses/${a.id}`, { method: "PUT", body: { ...a, isDefault: true } }).catch((e) => setError(e))
    await load()
  }
  if (!list) return error ? <Notice text={errorText(error, t.offline)} onRetry={load} retryLabel={t.retry} /> : <Loading />
  return (
    <Screen footer={list.length < 10 ? <Button title={t.addAddress} onPress={() => router.push("/address")} /> : undefined}>
      {error ? <Notice text={errorText(error, t.offline)} /> : null}
      {!list.length && <Empty title={t.noAddresses} />}
      {list.map((a) => (
        <Card key={a.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="h3">{a.label || catalog?.areas.find((x) => x.slug === a.area)?.name || a.area}</Txt>
            {a.isDefault && <Badge text={t.isDefault} tone="green" />}
          </Row>
          <Txt>{[a.line, a.subArea, catalog?.areas.find((x) => x.slug === a.area)?.name].filter(Boolean).join(", ")}</Txt>
          {a.landmark ? <Txt v="muted">{a.landmark}</Txt> : null}
          {a.lat != null && <Txt v="muted">📍 {t.pinSaved}</Txt>}
          <Row wrap>
            <Button small variant="light" title={t.edit} onPress={() => router.push({ pathname: "/address", params: { id: a.id } })} />
            {!a.isDefault && <Button small variant="light" title={t.makeDefault} onPress={() => makeDefault(a)} />}
            <View style={{ flex: 1 }} />
            <Button small variant="ghost" title={t.delete} onPress={() => remove(a)} />
          </Row>
        </Card>
      ))}
    </Screen>
  )
}
