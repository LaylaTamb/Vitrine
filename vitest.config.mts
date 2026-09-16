import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Os testes cobrem só `lib/domain/` — TypeScript puro, sem React e sem
// Supabase. Nada aqui precisa de DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/domain/**/*.test.ts"],
  },
})
