// Where the apps find the Mjazo API: the live site, unless EXPO_PUBLIC_API_URL says otherwise
// (e.g. the laptop's dev server on the same Wi-Fi, http://192.168.1.20:3000, to try local changes).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://mjazo.vercel.app").replace(/\/$/, "")

/** The website, for links that open in the browser (terms, help). */
export const SITE_URL = "https://mjazo.vercel.app"
