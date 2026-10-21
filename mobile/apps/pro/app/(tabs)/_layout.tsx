import { color, Loading } from "@mjazo/shared"
import { Redirect, Tabs } from "expo-router"
import { CalendarDays, Inbox, UserRound, Wallet } from "lucide-react-native"
import { useSchedule } from "../../src/schedule"
import { useSession, useT } from "../../src/session"

// Signed in: Today, Offers (with how many wait for her answer), Earnings and Profile.

export default function TabsLayout() {
  const t = useT()
  const { session } = useSession()
  const { schedule } = useSchedule()
  if (session.state === "loading") return <Loading />
  if (session.state === "out") return <Redirect href="/login" />
  const waiting = schedule?.openOffers ?? 0
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.ink, tabBarInactiveTintColor: color.faint, tabBarStyle: { backgroundColor: color.paper, borderTopColor: color.line }, tabBarLabelStyle: { fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: t.tabToday, tabBarIcon: ({ color: c }) => <CalendarDays size={22} color={c} /> }} />
      <Tabs.Screen name="offers" options={{ title: t.tabOffers, tabBarBadge: waiting || undefined, tabBarBadgeStyle: { backgroundColor: color.brand, color: color.ink }, tabBarIcon: ({ color: c }) => <Inbox size={22} color={c} /> }} />
      <Tabs.Screen name="earnings" options={{ title: t.tabMoney, tabBarIcon: ({ color: c }) => <Wallet size={22} color={c} /> }} />
      <Tabs.Screen name="me" options={{ title: t.tabMe, tabBarIcon: ({ color: c }) => <UserRound size={22} color={c} /> }} />
    </Tabs>
  )
}
