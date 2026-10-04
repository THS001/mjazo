import { promises as fs } from "fs"
import path from "path"

// Small JSON files in .data/cms for local development (SEO reports, redirects). Writes go to a
// temporary file that then replaces the real one, so a reader never sees half a file; a file that
// can't be read is an error, never "empty" (an empty read followed by a save would wipe it).

export async function readJson<T>(file: string, empty: T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as T
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty
      // Windows can briefly lock a file while it's being replaced: try again before giving up.
      if (attempt >= 4) throw e
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
    }
  }
}

export async function writeJson(file: string, data: unknown, pretty = false) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, pretty ? 1 : undefined))
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(tmp, file)
    } catch (e) {
      if (attempt >= 4) {
        await fs.rm(tmp, { force: true })
        throw e
      }
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
    }
  }
}
