"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Runs on the site while an editor previews drafts, and only inside the editor's live preview (an
// iframe in /admin, same origin). It refreshes when the editor saves, scrolls to the block being
// edited, and in click-to-edit mode turns a click into "edit this" instead of following links.

type FromEditor = { type: "cms:refresh" } | { type: "cms:mode"; edit: boolean } | { type: "cms:scroll"; path: string }

/** The element whose text a click means: the nearest text-like element. */
const TEXTUAL = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,label,button,a,summary,td,th"

function textOf(el: HTMLElement): string {
  // Animated headlines keep their words in an aria-label (the letters are separate spans).
  const labelled = el.matches("[aria-label]") && el.querySelector("[aria-hidden]") ? el : el.querySelector<HTMLElement>("[aria-label]:has(> [aria-hidden])")
  return (labelled?.getAttribute("aria-label") ?? el.innerText ?? "").trim().slice(0, 400)
}

export function PreviewBridge() {
  const router = useRouter()
  useEffect(() => {
    if (window.parent === window) return
    const parent = window.parent
    const send = (msg: Record<string, unknown>) => parent.postMessage(msg, location.origin)
    const html = document.documentElement
    html.dataset.cmsEmbed = ""
    const style = document.createElement("style")
    style.textContent = `
      html[data-cms-edit] [data-cms-hover] { outline: 2px solid #F4A437 !important; outline-offset: 3px; border-radius: 4px; cursor: pointer !important; }
      html[data-cms-edit] a, html[data-cms-edit] button { cursor: pointer !important; }
      [data-cms-focus] { outline: 3px solid #F4A437 !important; outline-offset: -3px; transition: outline-color 1s; }`
    document.head.append(style)

    let edit = true
    html.toggleAttribute("data-cms-edit", edit)
    let hovered: HTMLElement | null = null
    const target = (t: EventTarget | null) => (t instanceof Element ? (t.closest(TEXTUAL) as HTMLElement | null) ?? (t.closest("[data-cms]") as HTMLElement | null) : null)
    const setHover = (el: HTMLElement | null) => {
      if (hovered === el) return
      hovered?.removeAttribute("data-cms-hover")
      hovered = el
      el?.setAttribute("data-cms-hover", "")
    }

    const onOver = (e: MouseEvent) => edit && setHover(target(e.target))
    const onLeave = () => setHover(null)
    const onClick = (e: MouseEvent) => {
      if (!edit) return
      const el = target(e.target)
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      send({ type: "cms:pick", path: el.closest("[data-cms]")?.getAttribute("data-cms") ?? null, text: textOf(el), lang: html.lang === "ur" ? "ur" : "en" })
    }
    const onMessage = (e: MessageEvent<FromEditor>) => {
      if (e.origin !== location.origin || e.source !== parent) return
      const m = e.data
      if (m?.type === "cms:refresh") router.refresh()
      else if (m?.type === "cms:mode") {
        edit = m.edit
        html.toggleAttribute("data-cms-edit", edit)
        if (!edit) setHover(null)
      } else if (m?.type === "cms:scroll") {
        const el = document.querySelector<HTMLElement>(`[data-cms="${CSS.escape(m.path)}"]`)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        el.setAttribute("data-cms-focus", "")
        setTimeout(() => el.removeAttribute("data-cms-focus"), 1400)
      }
    }

    document.addEventListener("mouseover", onOver, true)
    document.addEventListener("mouseleave", onLeave)
    document.addEventListener("click", onClick, true)
    window.addEventListener("message", onMessage)
    send({ type: "cms:ready", path: location.pathname })
    return () => {
      document.removeEventListener("mouseover", onOver, true)
      document.removeEventListener("mouseleave", onLeave)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("message", onMessage)
      style.remove()
    }
  }, [router])
  return null
}
