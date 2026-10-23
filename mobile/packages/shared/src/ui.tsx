import type { ReactNode } from "react"
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useDir } from "./i18n"
import { color, radius, space, tone as tones, type, type Tone } from "./theme"

// The building blocks every screen uses, so both apps look like the website: rounded white cards
// on warm white, ink buttons, one saffron accent. Text aligns right in Urdu.

export function Screen({ children, scroll = true, refreshing, onRefresh, top = false, padded = true, footer }: { children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; top?: boolean; padded?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const pad: ViewStyle = { paddingTop: (top ? insets.top : 0) + (padded ? space.lg : 0), paddingHorizontal: padded ? space.lg : 0, paddingBottom: space.xxl + (footer ? 0 : insets.bottom) }
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { gap: space.md }]} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={color.ink} /> : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View style={[pad, { flex: 1, gap: space.md }]}>{children}</View>
      )}
      {footer && <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: color.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }}>{footer}</View>}
    </View>
  )
}

type TextVariant = "title" | "h2" | "h3" | "body" | "small" | "muted" | "tiny"
export function Txt({ children, v = "body", style, center, numberOfLines, selectable }: { children: ReactNode; v?: TextVariant; style?: StyleProp<TextStyle>; center?: boolean; numberOfLines?: number; selectable?: boolean }) {
  const { align } = useDir()
  const base: TextStyle = v === "muted" ? { ...type.small, color: color.muted } : v === "tiny" ? { ...type.tiny, color: color.muted, textTransform: "uppercase" } : { ...type[v], color: color.ink }
  return (
    <Text style={[base, { textAlign: center ? "center" : align }, style]} numberOfLines={numberOfLines} selectable={selectable}>
      {children}
    </Text>
  )
}

export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  const { row } = useDir()
  return <View style={[{ flexDirection: row, alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>{children}</View>
}

export function Card({ children, onPress, style, tint }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; tint?: string }) {
  const s = [styles.card, tint ? { backgroundColor: tint } : null, style]
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={s}>{children}</View>
  )
}

type BtnVariant = "dark" | "brand" | "light" | "danger" | "ghost" | "whatsapp"
export function Button({ title, onPress, variant = "dark", busy, disabled, icon, small, style }: { title: string; onPress: () => void; variant?: BtnVariant; busy?: boolean; disabled?: boolean; icon?: ReactNode; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const { row } = useDir()
  const bg = { dark: color.ink, brand: color.brand, light: color.paper, danger: color.red, ghost: "transparent", whatsapp: color.whatsapp }[variant]
  // WhatsApp green takes ink text, as on the website (brand kit).
  const fg = variant === "light" || variant === "ghost" || variant === "brand" || variant === "whatsapp" ? color.ink : color.paper
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        { flexDirection: row, alignItems: "center", justifyContent: "center", gap: space.sm, height: small ? 38 : 50, paddingHorizontal: small ? space.md : space.lg, borderRadius: radius.pill, backgroundColor: bg },
        variant === "light" && { borderWidth: 1, borderColor: color.field },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon}
      <Text style={{ color: fg, fontSize: small ? 13 : 15, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  )
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secure, multiline, error, autoCapitalize, maxLength, hint, editable = true, otp, autoFocus }: { label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: KeyboardTypeOptions; secure?: boolean; multiline?: boolean; error?: string | null; autoCapitalize?: "none" | "sentences" | "words"; maxLength?: number; hint?: string; editable?: boolean; /** A one-time code: the phone offers the code from its SMS. */ otp?: boolean; autoFocus?: boolean }) {
  const { align } = useDir()
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt v="small" style={{ fontWeight: "600" }}>{label}</Txt>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={editable}
        autoFocus={autoFocus}
        {...(otp ? { autoComplete: "sms-otp" as const, textContentType: "oneTimeCode" as const } : {})}
        style={[styles.input, multiline && { height: 96, paddingTop: 12, textAlignVertical: "top" }, { textAlign: align }, error ? { borderColor: color.red } : null, !editable && { opacity: 0.6 }]}
      />
      {error ? <Txt v="small" style={{ color: color.red }}>{error}</Txt> : hint ? <Txt v="muted">{hint}</Txt> : null}
    </View>
  )
}

export function Badge({ text, tone = "neutral" }: { text: string; tone?: Tone }) {
  const t = tones[tone]
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </View>
  )
}

export function Chip({ label, selected, onPress, disabled, sub }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean; sub?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected, disabled }} style={[styles.chip, selected && { backgroundColor: color.ink, borderColor: color.ink }, disabled && { opacity: 0.35 }]}>
      <Text style={{ color: selected ? color.paper : color.ink, fontSize: 14, fontWeight: "600", textAlign: "center" }}>{label}</Text>
      {sub ? <Text style={{ color: selected ? "#DDDDDD" : color.muted, fontSize: 11, textAlign: "center" }}>{sub}</Text> : null}
    </Pressable>
  )
}

export function Switch({ on, onChange, busy, label }: { on: boolean; onChange: (on: boolean) => void; busy?: boolean; label: string }) {
  const { rtl } = useDir()
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on, busy }} accessibilityLabel={label} disabled={busy} onPress={() => onChange(!on)} style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: on ? color.ink : "#D4D4D4", opacity: busy ? 0.6 : 1, alignItems: on !== rtl ? "flex-end" : "flex-start" }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color.paper }} />
    </Pressable>
  )
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: space.sm }}>
      <Txt v="h3" center>
        {title}
      </Txt>
      {body && (
        <Txt v="muted" center>
          {body}
        </Txt>
      )}
      {action}
    </View>
  )
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, minHeight: 200, alignItems: "center", justifyContent: "center", gap: space.sm }}>
      <ActivityIndicator color={color.ink} />
      {label && <Txt v="muted">{label}</Txt>}
    </View>
  )
}

export function Notice({ text, tone = "red", onRetry, retryLabel }: { text: string; tone?: Tone; onRetry?: () => void; retryLabel?: string }) {
  const t = tones[tone]
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
      {onRetry && (
        <Pressable onPress={onRetry}>
          <Text style={{ color: t.fg, fontWeight: "700", textDecorationLine: "underline" }}>{retryLabel ?? "Try again"}</Text>
        </Pressable>
      )}
    </View>
  )
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: space.xs }} />

/** A line of label and value, e.g. "Total · PKR 4,500". */
export function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Txt v={strong ? "h3" : "body"} style={{ color: strong ? color.ink : color.muted, flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt v={strong ? "h3" : "body"}>{value}</Txt>
    </Row>
  )
}

/** A bottom sheet for a short form (cancel with a reason, pick a time). */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    // No slide on the web (development only): a paused browser tab never finishes the animation.
    <Modal visible={open} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} />
      <View style={{ backgroundColor: color.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: insets.bottom + space.lg, gap: space.md, maxHeight: "85%" }}>
        <ScrollView contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  )
}

/** Asks yes or no (the phone's own dialog; the browser's on web). */
export function confirm(title: string, body: string, yes: string, no: string, danger = false): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${body}`))
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: no, style: "cancel", onPress: () => resolve(false) },
      { text: yes, style: danger ? "destructive" : "default", onPress: () => resolve(true) },
    ]),
  )
}

/** Tells the person something (the phone's own dialog; the browser's on web). */
export function tell(title: string, body?: string) {
  if (Platform.OS === "web") window.alert(body ? `${title}\n\n${body}` : title)
  else Alert.alert(title, body)
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.paper, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: color.field, backgroundColor: color.paper, paddingHorizontal: space.lg, fontSize: 16, color: color.ink },
  chip: { minWidth: 64, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: color.field, backgroundColor: color.paper },
})
