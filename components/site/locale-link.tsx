"use client"

import NextLink from "next/link"
import { useRouter as useNextRouter } from "next/navigation"
import { forwardRef, useMemo, type ComponentProps } from "react"
import { localePath } from "@/lib/i18n"
import { useLocale } from "@/components/cms/provider"

// next/link for the public site: on Urdu pages, internal links stay in Urdu (/services -> /ur/services).
// Staff apps, APIs, other sites and #anchors are left as they are.

type Props = ComponentProps<typeof NextLink>

const Link = forwardRef<HTMLAnchorElement, Props>(function LocaleLink({ href, ...rest }, ref) {
  const locale = useLocale()
  const to = typeof href === "string" && locale !== "en" ? localePath(href, locale) : href
  return <NextLink ref={ref} href={to} {...rest} />
})

export default Link
export { Link }

/** next/navigation's router, with push/replace kept in the page's locale. */
export function useRouter() {
  const r = useNextRouter()
  const locale = useLocale()
  return useMemo(
    () => ({
      ...r,
      push: (href: string, o?: Parameters<typeof r.push>[1]) => r.push(localePath(href, locale), o),
      replace: (href: string, o?: Parameters<typeof r.replace>[1]) => r.replace(localePath(href, locale), o),
      prefetch: (href: string, o?: Parameters<typeof r.prefetch>[1]) => r.prefetch(localePath(href, locale), o),
    }),
    [r, locale],
  )
}

/** A path in the current page's locale, for router.push and plain <a> tags. */
export function useLocalePath() {
  const locale = useLocale()
  return (path: string) => localePath(path, locale)
}
