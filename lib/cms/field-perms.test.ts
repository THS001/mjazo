import { describe, expect, it } from "vitest"
import { fieldPermError, onlySeoChanged, publishPermError, seoOnly, typeAccessError } from "./field-perms"
import { getType } from "./registry"
import { ROLES, type Role } from "./roles"
import "./types"

// What each role may change inside an entry. The SEO role sees everything but may change and
// publish SEO fields only; nobody without "seo" may touch SEO fields; prices need "prices".

const service = getType("service")!
const settings = getType("settings-site")!
const seoSettings = getType("settings-seo")!
const post = getType("post")!

const base = { name: { en: "Full body waxing" }, slug: "full-body-wax", category: "womens-salon", short: { en: "All over" }, price: 4600, duration: 120, seo: { title: { en: "" }, keyword: { en: "" } } }
const withSeo = { ...base, seo: { title: { en: "Full body waxing at home in Karachi" }, keyword: { en: "full body wax karachi" } } }
const renamed = { ...base, name: { en: "Full body wax" } }
const repriced = { ...base, price: 5000 }

const allowed = (role: Role) => (before: Record<string, unknown>, after: Record<string, unknown>) => fieldPermError(service.fields, role, before, after)

describe("SEO role", () => {
  it("is the only role limited to SEO fields", () => {
    expect(ROLES.filter(seoOnly)).toEqual(["seo"])
  })

  it("may open any type, including settings, but change SEO fields only", () => {
    expect(typeAccessError(service, "seo")).toBeNull()
    expect(typeAccessError(settings, "seo")).toBeNull()
    expect(allowed("seo")(base, withSeo)).toBeNull()
    expect(allowed("seo")(base, renamed)).toBe("Your role can change SEO fields only.")
    expect(allowed("seo")(base, repriced)).toBe("Only Owners and Admins can change prices.")
  })

  it("can't change ordinary settings, but can change SEO settings", () => {
    const site = { name: "Mjazo" }
    expect(fieldPermError(settings.fields, "seo", site, { name: "Mjazo!" })).toBe("Your role can change SEO fields only.")
    expect(fieldPermError(seoSettings.fields, "seo", { titleTemplate: "%s · Mjazo" }, { titleTemplate: "%s | Mjazo" })).toBeNull()
  })

  it("may publish when only SEO fields differ from the live version", () => {
    expect(publishPermError(service.fields, "seo", base, withSeo)).toBeNull()
    expect(publishPermError(service.fields, "seo", base, { ...withSeo, name: { en: "Changed by an editor" } })).toMatch(/SEO changes only/)
  })
})

describe("other roles", () => {
  it("lets Owners and Admins change everything", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(allowed(role)(base, { ...withSeo, price: 5000, name: { en: "x" } })).toBeNull()
      expect(typeAccessError(settings, role)).toBeNull()
    }
  })

  it("lets Editors change content and SEO, but not prices or settings", () => {
    expect(allowed("editor")(base, withSeo)).toBeNull()
    expect(allowed("editor")(base, renamed)).toBeNull()
    expect(allowed("editor")(base, repriced)).toBe("Only Owners and Admins can change prices.")
    expect(typeAccessError(settings, "editor")).toBe("Only Owners and Admins can change site settings.")
  })

  it("keeps Authors to the blog and help, without SEO fields", () => {
    expect(typeAccessError(post, "author")).toBeNull()
    expect(typeAccessError(service, "author")).toBe("Authors can edit blog posts and help articles only.")
    const p = { title: { en: "Post" }, seo: { title: { en: "" } } }
    expect(fieldPermError(post.fields, "author", p, { ...p, title: { en: "Better post" } })).toBeNull()
    expect(fieldPermError(post.fields, "author", p, { ...p, seo: { title: { en: "Search title" } } })).toBe("Your role can't change SEO fields.")
    expect(publishPermError(post.fields, "author", p, { ...p, title: { en: "Better post" } })).toMatch(/can't publish/)
  })

  it("leaves Viewers read-only", () => {
    expect(typeAccessError(service, "viewer")).toBe("Your role can view content but not change it.")
    expect(publishPermError(service.fields, "viewer", base, base)).toMatch(/can't publish/)
  })
})

describe("onlySeoChanged", () => {
  it("looks inside groups and ignores SEO-only differences", () => {
    expect(onlySeoChanged(service.fields, base, withSeo)).toBe(true)
    expect(onlySeoChanged(service.fields, base, renamed)).toBe(false)
    expect(onlySeoChanged(service.fields, null, base)).toBe(false)
  })
})
