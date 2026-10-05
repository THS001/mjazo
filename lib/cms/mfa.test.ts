import { describe, expect, it } from "vitest"
import { mfaRequired, mfaState } from "./mfa"
import { ROLES } from "./roles"

// Two-step sign-in: who must use it, and when the admin waits for a code.

const noFactor = { currentLevel: "aal1", nextLevel: "aal1" }
const factorNoCode = { currentLevel: "aal1", nextLevel: "aal2" }
const done = { currentLevel: "aal2", nextLevel: "aal2" }

describe("mfaState", () => {
  it("makes Owners and Admins set it up, and leaves the other roles free to", () => {
    for (const role of ROLES) expect(mfaState(role, noFactor, true)).toBe(role === "owner" || role === "admin" ? "needs-setup" : "ok")
  })

  it("asks anyone who has set it up for their code, every sign-in", () => {
    for (const role of ROLES) expect(mfaState(role, factorNoCode, true)).toBe("needs-code")
    for (const role of ROLES) expect(mfaState(role, done, true)).toBe("ok")
  })

  it("can be switched off for set-up (CMS_MFA_REQUIRED=false), but still asks for codes already set up", () => {
    expect(mfaState("owner", noFactor, false)).toBe("ok")
    expect(mfaState("owner", factorNoCode, false)).toBe("needs-code")
    expect(mfaRequired("false")).toBe(false)
    expect(mfaRequired(" FALSE ")).toBe(false)
    expect(mfaRequired(undefined)).toBe(true)
    expect(mfaRequired("true")).toBe(true)
  })

  it("treats an unreadable assurance level as no second step yet", () => {
    expect(mfaState("admin", null, true)).toBe("needs-setup")
    expect(mfaState("editor", null, true)).toBe("ok")
  })
})
