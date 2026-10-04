import Link from "next/link"
import { Icon, Pill } from "@/components/site/primitives"
import { getCatalog } from "@/lib/cms/read"

export default async function NotFound() {
  const { worlds } = await getCatalog()
  return (
    <div className="relative min-h-screen pt-32 pb-24 overflow-hidden flex flex-col items-center text-center px-4">
      <span aria-hidden className="absolute inset-x-0 top-24 font-bold text-[40vw] leading-none tracking-tighter text-zinc-100 select-none">404</span>
      <div className="relative">
        <h1 className="font-serif text-6xl sm:text-7xl mt-10">This room's empty.</h1>
        <p className="text-zinc-600 mt-4 max-w-md mx-auto">The page you're after has moved or never existed. Try one of these instead.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-2 max-w-2xl">
          {worlds.map((w) => (
            <Link key={w.slug} href={`/services/w/${w.slug}`} className="flex items-center gap-2 rounded-full h-11 px-4 text-sm" style={{ background: w.tint }}>
              <Icon name={w.icon} className="w-4 h-4" />{w.name}
            </Link>
          ))}
        </div>
        <div className="mt-10 flex justify-center"><Pill href="/">Back home</Pill></div>
      </div>
    </div>
  )
}
