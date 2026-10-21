import { Button, Chip, color, currentLocation, errorText, Field, fill, Loading, Notice, Row, Screen, Switch, Txt, type Address } from "@mjazo/shared"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { LocateFixed } from "lucide-react-native"
import { useEffect, useState } from "react"
import { useAccount, useCatalog, useT } from "../src/state"

// A saved address, new (no id) or changed: label, area, sub-area, street, landmark, and the
// phone's location when they're at home (the server works out the area from it and refuses spots
// outside the areas we cover).

export default function AddressScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { api } = useAccount()
  const { catalog } = useCatalog()
  const [a, setA] = useState<Partial<Address> | null>(id ? null : { label: "", area: "", subArea: null, line: "", landmark: "", lat: null, lng: null, isDefault: false })
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!id) return
    api<{ addresses: Address[] }>("/api/v1/customer/addresses").then(
      (r) => setA(r.addresses.find((x) => x.id === id) ?? null),
      (e) => setError(errorText(e, t.offline)),
    )
  }, [id, api, t.offline])
  if (!catalog || !a) return error ? <Notice text={error} /> : <Loading />
  const area = catalog.areas.find((x) => x.slug === a.area)
  const set = (p: Partial<Address>) => setA({ ...a, ...p })
  const locate = async () => {
    setLocating(true)
    const here = await currentLocation()
    setLocating(false)
    if (!here) return setError(t.noLocation)
    setError("")
    set({ lat: here.lat, lng: here.lng })
  }
  const save = async () => {
    if ((a.line ?? "").trim().length < 5) return setError(t.errAddress)
    if (!a.area && a.lat == null) return setError(t.errArea)
    setBusy(true)
    setError("")
    try {
      const body = { label: a.label?.trim() || null, area: a.area || undefined, subArea: a.subArea || null, line: a.line!.trim(), landmark: a.landmark?.trim() || null, lat: a.lat ?? null, lng: a.lng ?? null, isDefault: Boolean(a.isDefault) }
      await api(id ? `/api/v1/customer/addresses/${id}` : "/api/v1/customer/addresses", { method: id ? "PUT" : "POST", body })
      router.back()
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen footer={<Button title={t.saveAddress} busy={busy} onPress={save} />}>
      <Stack.Screen options={{ title: id ? t.edit : t.addAddress }} />
      <Field label={t.label} value={a.label ?? ""} onChangeText={(v) => set({ label: v })} maxLength={40} />
      <Txt v="small" style={{ fontWeight: "600" }}>
        {t.area}
      </Txt>
      <Row wrap>
        {catalog.areas.map((x) => (
          <Chip key={x.slug} label={x.name} selected={a.area === x.slug} onPress={() => set({ area: x.slug, subArea: null })} />
        ))}
      </Row>
      {area && area.subAreas.length > 0 && (
        <>
          <Txt v="small" style={{ fontWeight: "600" }}>
            {fill(t.subArea, { area: area.name })}
          </Txt>
          <Row wrap>
            {area.subAreas.map((s) => (
              <Chip key={s} label={s} selected={a.subArea === s} onPress={() => set({ subArea: a.subArea === s ? null : s })} />
            ))}
          </Row>
        </>
      )}
      <Field label={t.line} value={a.line ?? ""} onChangeText={(v) => set({ line: v })} placeholder={t.addressHint} />
      <Field label={t.landmark} value={a.landmark ?? ""} onChangeText={(v) => set({ landmark: v })} />
      <Button title={locating ? t.locating : t.myLocation} variant="light" small busy={locating} icon={<LocateFixed size={16} color={color.ink} />} onPress={locate} style={{ alignSelf: "flex-start" }} />
      {a.lat != null && <Notice tone="green" text={t.pinSaved} />}
      <Row style={{ justifyContent: "space-between" }}>
        <Txt>{t.makeDefault}</Txt>
        <Switch on={Boolean(a.isDefault)} onChange={(v) => set({ isDefault: v })} label={t.makeDefault} />
      </Row>
      {error ? <Notice text={error} /> : null}
    </Screen>
  )
}
