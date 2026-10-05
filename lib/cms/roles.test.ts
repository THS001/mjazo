import { describe, expect, it } from "vitest"
import { ownerEmails } from "./roles"

// CMS_OWNER_EMAIL: who becomes an Owner on their first sign-in.

describe("ownerEmails", () => {
  it("reads one email, or several separated by commas, in any case", () => {
    expect(ownerEmails("Owner@Mjazo.pk")).toEqual(["owner@mjazo.pk"])
    expect(ownerEmails(" Mjazosupport@gmail.com, b@x.pk ;c@y.pk ")).toEqual(["mjazosupport@gmail.com", "b@x.pk", "c@y.pk"])
  })

  it("names nobody when it's empty or not an email", () => {
    expect(ownerEmails(undefined)).toEqual([])
    expect(ownerEmails("")).toEqual([])
    expect(ownerEmails("owner")).toEqual([])
  })
})
