import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/server-only.ts"),
    },
  },
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["node_modules", ".next"] },
})
