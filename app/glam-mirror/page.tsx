import type { Metadata } from "next"
import { GlamMirror } from "@/components/glam/glam-mirror"

export const metadata: Metadata = {
  alternates: { canonical: "/glam-mirror" },
  title: "Glam Mirror: try mehndi and makeup before you book",
  description: "Try mehndi designs on a photo of your own hand and see lip colours, blush, kajal and hair colour live on your face. It all runs on your phone. Save the look and send it to your Mjazo pro.",
}

export default function GlamMirrorPage() {
  return <GlamMirror />
}
