import { Inter, Noto_Nastaliq_Urdu, Playfair_Display } from "next/font/google"

// Fonts shared by the site and the staff apps (each has its own root layout).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" })
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-urdu-nastaliq", display: "swap" })

export const fontVars = `${inter.variable} ${playfair.variable} ${urdu.variable}`
