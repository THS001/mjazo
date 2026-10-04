// Redirects built into the site's code. next.config.mjs applies them before anything else, so the
// CMS (/admin/redirects) lists them read-only and won't let one of its own redirects clash with them.

/** @type {{ source: string; destination: string; permanent: boolean }[]} */
export const BUILTIN_REDIRECTS = [
  { source: "/account/plus", destination: "/plus", permanent: false },
  { source: "/account/referrals", destination: "/refer", permanent: false },
  { source: "/join", destination: "/partner", permanent: true },
  { source: "/book", destination: "/services/w/beauty-wellness", permanent: false },
  { source: "/areas", destination: "/karachi", permanent: true },
  { source: "/packages", destination: "/offers", permanent: true },
  { source: "/faq", destination: "/help", permanent: true },
]
