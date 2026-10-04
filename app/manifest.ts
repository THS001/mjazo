import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mjazo · Home services in Karachi",
    short_name: "Mjazo",
    description: "Book verified pros for salon at home, cleaning, AC, repairs and more across Karachi. Pay after.",
    start_url: "/?source=app",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#f4a437",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  }
}
