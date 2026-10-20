/** 03xxxxxxxxx form for matching phones typed in different ways. */
export function normalisePhone(p: string) {
  const d = p.replace(/\D/g, "")
  if (d.startsWith("0092")) return `0${d.slice(4)}`
  if (d.startsWith("92")) return `0${d.slice(2)}`
  return d.startsWith("0") ? d : `0${d}`
}

/** A short random id with a prefix, like C-LZ3K9QX2. */
export const coreId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
