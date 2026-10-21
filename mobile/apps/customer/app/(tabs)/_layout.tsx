import { color } from "@mjazo/shared"
import { Tabs } from "expo-router"
import { CalendarCheck, House, UserRound } from "lucide-react-native"
import { useT } from "../../src/state"

export default function TabsLayout() {
  const t = useT()
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.ink, tabBarInactiveTintColor: color.faint, tabBarStyle: { backgroundColor: color.paper, borderTopColor: color.line }, tabBarLabelStyle: { fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: t.home, tabBarIcon: ({ color: c }) => <House size={22} color={c} /> }} />
      <Tabs.Screen name="bookings" options={{ title: t.bookings, tabBarIcon: ({ color: c }) => <CalendarCheck size={22} color={c} /> }} />
      <Tabs.Screen name="account" options={{ title: t.account, tabBarIcon: ({ color: c }) => <UserRound size={22} color={c} /> }} />
    </Tabs>
  )
}
