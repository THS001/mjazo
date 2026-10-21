// Questions in the terminal for the setup scripts. Keys are read one by one (raw mode) rather than
// through readline: readline clears its line as soon as it starts and on every key, which wiped
// out the question printed before it. The owner saw a blank line, typed the database password into
// a yes/no question (where it showed), and the hidden password question got an empty answer.

/**
 * One answer being typed. feed() takes what the terminal sends (typed keys or a paste) and returns
 * what to show, and the answer once Enter ends it, with any characters that came after it. An
 * Enter with nothing typed doesn't end a `required` answer (a stray Enter, or the "\n" of "\r\n").
 */
export function lineReader({ hidden = false, required = false } = {}) {
  let text = ""
  return {
    feed(chunk) {
      let echo = ""
      const chars = [...chunk.replace(/\x1b\[20[01]~/g, "")] // bracketed-paste markers
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]
        if (ch === "\u0003") return { echo, cancelled: true } // Ctrl+C
        if (ch === "\r" || ch === "\n") {
          if (required && !text.trim()) continue
          return { echo, answer: text.trim(), rest: chars.slice(i + 1).join(""), endedWithCR: ch === "\r" }
        }
        if (ch === "\u007f" || ch === "\b") {
          if (text) {
            text = text.slice(0, -1)
            echo += "\b \b"
          }
          continue
        }
        if (ch < " ") continue
        text += ch
        echo += hidden ? "*" : ch
      }
      return { echo }
    },
  }
}

let pending = "" // characters that arrived after the previous answer's Enter
let skipLF = false // the previous answer ended with "\r": a "\n" next belongs to it

/** Asks in the terminal. `hidden` shows * for each character; `required` waits for a non-empty answer. */
export function ask(question, { hidden = false, required = false } = {}) {
  process.stdout.write(question)
  const stdin = process.stdin
  const raw = Boolean(stdin.isTTY)
  const reader = lineReader({ hidden, required })
  return new Promise((resolve) => {
    const stop = () => {
      stdin.off("data", take)
      stdin.off("end", ended)
      if (raw) stdin.setRawMode(false)
      stdin.pause()
    }
    const ended = () => {
      stop()
      console.error("\n✗ No answer: the input ended.")
      process.exit(1)
    }
    function take(chunk) {
      if (skipLF) {
        skipLF = false
        if (chunk.startsWith("\n")) chunk = chunk.slice(1)
      }
      if (!chunk) return
      const r = reader.feed(chunk)
      if (r.echo) process.stdout.write(r.echo)
      if (r.cancelled) {
        stop()
        process.stdout.write("\n")
        process.exit(130)
      }
      if (r.answer === undefined) return
      stop()
      pending = r.rest
      skipLF = r.endedWithCR
      process.stdout.write(hidden ? " (received)\n" : "\n")
      resolve(r.answer)
    }
    if (raw) stdin.setRawMode(true)
    stdin.setEncoding("utf8")
    stdin.on("data", take)
    stdin.once("end", ended)
    stdin.resume()
    if (pending) {
      const p = pending
      pending = ""
      take(p)
    }
  })
}
