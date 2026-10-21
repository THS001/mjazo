import { AirVent, Baby, BatteryCharging, Bug, Car, Droplets, Hammer, Hand, Palette, PaintRoller, Scissors, ShowerHead, Sofa, Sparkles, SprayCan, Stethoscope, Sun, Truck, User, WashingMachine, Wrench, Zap, type LucideIcon } from "lucide-react-native"

// The catalogue's icons (the same Lucide names the website uses). A name the CMS adds later that
// isn't here shows the sparkles.

const ICONS: Record<string, LucideIcon> = { AirVent, Baby, BatteryCharging, Bug, Car, Droplets, Hammer, Hand, Palette, PaintRoller, Scissors, ShowerHead, Sofa, Sparkles, SprayCan, Stethoscope, Sun, Truck, User, WashingMachine, Wrench, Zap }

export function CatalogIcon({ name, size = 22, color = "#111111" }: { name: string; size?: number; color?: string }) {
  const Icon = ICONS[name] ?? Sparkles
  return <Icon size={size} color={color} strokeWidth={1.75} />
}
