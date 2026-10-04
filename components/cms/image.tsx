import Image from "next/image"
import type { CSSProperties } from "react"
import type { Img } from "@/lib/cms/fields"
import { cn } from "@/lib/utils"

// An image from the media library, optimised by next/image (Supabase Storage or the local dev
// route). The focal point set in the library keeps the important part in view when cropped, and the
// image's average colour fills the space while it loads.

export const isImage = (img: Img | undefined): img is NonNullable<Img> => Boolean(img?.url) && (!img!.mime || img!.mime.startsWith("image/"))

export function CmsImage({ img, sizes = "100vw", className, priority, fill = true, alt, style }: { img: Img | undefined; sizes?: string; className?: string; priority?: boolean; fill?: boolean; alt?: string; style?: CSSProperties }) {
  if (!isImage(img)) return null
  const s: CSSProperties = { objectPosition: img.focal ? `${img.focal[0] * 100}% ${img.focal[1] * 100}%` : undefined, backgroundColor: img.color, ...style }
  if (fill) return <Image src={img.url} alt={alt ?? img.alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} style={s} />
  return <Image src={img.url} alt={alt ?? img.alt} width={img.w ?? 1600} height={img.h ?? 1000} sizes={sizes} priority={priority} className={className} style={s} />
}
