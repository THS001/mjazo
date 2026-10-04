import type { Metadata } from "next"
import { Instagram, Mail, MessageCircle, PhoneCall } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container } from "@/components/site/primitives"
import { EnquiryForm } from "@/components/site/forms"
import { getPage, getSettings } from "@/lib/cms/read"
import type { ContactContent } from "@/lib/cms/types/pages/company"
import { waLink } from "@/lib/site"
import { pageLocale } from "@/lib/cms/locale"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const { site } = await getSettings()
  return { alternates: { canonical: "/contact" }, title: "Contact Mjazo: WhatsApp, phone & email", description: `WhatsApp, call or email Mjazo. ${site.hours}.` }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const [{ site }, c] = await Promise.all([getSettings(), getPage<ContactContent>("contact")])
  const ways = [
    { icon: MessageCircle, t: c.whatsapp.title, d: c.whatsapp.body, href: waLink(site.whatsapp, c.whatsapp.message), cta: c.whatsapp.cta, primary: true },
    { icon: PhoneCall, t: c.call.title, d: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}`, cta: c.call.cta },
    { icon: Mail, t: c.email.title, d: site.email, href: `mailto:${site.email}`, cta: c.email.cta },
    { icon: Instagram, t: c.instagram.title, d: c.instagram.handle, href: site.instagram, cta: c.instagram.cta },
  ]
  return (
    <>
      <PageHero
        image={c.heroImage}
        crumbs={[{ label: "Contact" }]}
        eyebrow={c.hero.eyebrow || site.hours}
        title={c.hero.title}
        sub={c.hero.sub}
        style={{ background: "linear-gradient(180deg, #e9f6ee 0%, #fafaf8 100%)" }}
        bgWord="HELLO"
      />
      <section className="pb-12 -mt-6">
        <Container className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ways.map((w, i) => (
            <a
              key={i}
              href={w.href}
              target={w.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`group rounded-3xl p-7 border transition-all hover:-translate-y-1 ${w.primary ? "bg-[#25D366] text-foreground border-[#25D366]" : "bg-white border-zinc-200"}`}
            >
              <w.icon className="w-7 h-7" strokeWidth={1.5} />
              <p className="text-xl font-medium mt-10">{w.t}</p>
              <p className={`text-sm mt-1 ${w.primary ? "text-foreground/75" : "text-zinc-500"}`}>{w.d}</p>
              <p className="text-sm mt-6 underline underline-offset-4">{w.cta}</p>
            </a>
          ))}
        </Container>
      </section>
      <section className="py-20">
        <Container className="max-w-3xl">
          <p className="font-serif text-4xl mb-6">{c.form.title}</p>
          <EnquiryForm kind="contact" submitLabel={c.form.submit} success={c.form.success} />
        </Container>
      </section>
    </>
  )
}
