import { describe, expect, it } from "vitest"
import { canOps, OPS_PERMS, OPS_ROLE_PERMS, opsPermsOf, secondPersonProblem, type OpsPerm } from "./access"
import { CMS_ROLES, OPS_ROLES, ROLES, can, type Role } from "@/lib/cms/roles"
import { MFA_ROLES, mfaState } from "@/lib/cms/mfa"
import { safeNext } from "@/lib/cms/next-path"

// Mission control's permission matrix by role (the server checks it on every /api/ops action:
// lib/server/ops-permissions.test.ts runs the real routes against it).

const WHO: Record<OpsPerm, Role[]> = {
  "ops.view": ["owner", "admin", "dispatcher", "support", "finance", "recruiter"],
  "ops.dispatch": ["owner", "admin", "dispatcher"],
  "ops.bookings": ["owner", "admin", "dispatcher", "support"],
  "ops.requests": ["owner", "admin", "support"],
  "ops.money.request": ["owner", "admin", "support", "finance"],
  "ops.money": ["owner", "finance"],
  "ops.pros": ["owner", "admin", "dispatcher", "recruiter"],
  "ops.verify": ["owner", "admin", "recruiter"],
  "ops.recruit": ["owner", "admin", "recruiter"],
  "ops.promos": ["owner", "admin", "finance"],
  "ops.kpi": ["owner", "admin", "dispatcher", "finance"],
  "ops.audit": ["owner", "admin", "finance"],
  "ops.ai": ["owner", "admin", "dispatcher", "support"],
}

describe("mission control permissions", () => {
  for (const perm of OPS_PERMS)
    it(`${perm}: ${WHO[perm].join(", ")}`, () => {
      expect(Object.fromEntries(ROLES.map((r) => [r, canOps(r, perm)]))).toEqual(Object.fromEntries(ROLES.map((r) => [r, WHO[perm].includes(r)])))
    })

  it("gives the website-only roles no mission control at all", () => {
    for (const r of ["editor", "author", "seo", "viewer"] as Role[]) expect(opsPermsOf(r)).toEqual([])
    expect(canOps(null, "ops.view")).toBe(false)
  })

  it("gives the operations roles no CMS access at all", () => {
    for (const r of OPS_ROLES) expect(can(r, "view")).toBe(false)
    for (const r of CMS_ROLES) expect(can(r, "view")).toBe(true)
  })

  it("lists every role in the matrix", () => {
    expect(Object.keys(OPS_ROLE_PERMS).sort()).toEqual([...ROLES].sort())
  })
})

describe("money approvals need a second person", () => {
  it("stops someone approving what they asked for, unless they're an Owner", () => {
    expect(secondPersonProblem({ email: "fin@mjazo.pk", role: "finance" }, "FIN@mjazo.pk")).toMatch(/Someone else/)
    expect(secondPersonProblem({ email: "fin@mjazo.pk", role: "finance" }, "support@mjazo.pk")).toBeNull()
    expect(secondPersonProblem({ email: "boss@mjazo.pk", role: "owner" }, "boss@mjazo.pk")).toBeNull()
  })
})

describe("two-step sign-in", () => {
  it("is required for Owners and Finance (who approve money), and Admins", () => {
    expect(MFA_ROLES).toEqual(expect.arrayContaining(["owner", "finance", "admin"]))
    expect(mfaState("finance", { currentLevel: "aal1", nextLevel: "aal1" }, true)).toBe("needs-setup")
    expect(mfaState("dispatcher", { currentLevel: "aal1", nextLevel: "aal1" }, true)).toBe("ok")
  })
})

describe("after signing in", () => {
  it("goes only to the CMS or mission control", () => {
    expect(safeNext("/ops")).toBe("/ops")
    expect(safeNext("/admin/account")).toBe("/admin/account")
    expect(safeNext("/ops?tab=money")).toBe("/ops?tab=money")
    for (const bad of ["https://evil.example", "//evil.example", "/opsx", "/admin.evil", "", null, undefined]) expect(safeNext(bad)).toBe("/admin")
  })
})
