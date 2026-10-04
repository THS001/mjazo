import type { CSSProperties } from "react"

// Headlines from the CMS can mark words with *asterisks* to show them in the italic accent style.

/** Renders text with *marked* words wrapped in a span with the accent class or style. */
export function Accent({ text, className = "italic", style }: { text: string; className?: string; style?: CSSProperties }) {
  return (
    <>
      {text.split(/\*([^*]+)\*/).map((part, i) =>
        i % 2 ? (
          <span key={i} className={className} style={style}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** The text without accent marks (for animated headlines and metadata). */
export const plainText = (text: string) => text.replace(/\*([^*]+)\*/g, "$1")
