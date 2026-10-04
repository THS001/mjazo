/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/account/plus", destination: "/plus", permanent: false },
      { source: "/account/referrals", destination: "/refer", permanent: false },
      { source: "/join", destination: "/partner", permanent: true },
      { source: "/book", destination: "/services/w/beauty-wellness", permanent: false },
      { source: "/areas", destination: "/karachi", permanent: true },
      { source: "/packages", destination: "/offers", permanent: true },
      { source: "/faq", destination: "/help", permanent: true },
    ]
  },
}

export default nextConfig
