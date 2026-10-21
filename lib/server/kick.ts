import "server-only"

// "Something changed: run the automation soon" (booking confirmations, offers to pros, …). Loaded
// lazily, so the ops and booking code that calls it doesn't import the whole engine.

export function kick() {
  if (process.env.NODE_ENV === "test") return
  void import("./automation").then((m) => m.kickAutomation()).catch((e) => console.error("[automation] kick failed", e))
}
