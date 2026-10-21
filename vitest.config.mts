import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Os testes cobrem `lib/domain/`, o tratamento das respostas da Geoapify
// (`lib/geo/`, só as funções puras de `parse.ts`) e os leitores das importações (`lib/import/`:
// CSV, .zip, Google Takeout, Letterboxd) — TypeScript puro, sem React, sem
// Supabase e sem rede. Nada aqui precisa de DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/domain/**/*.test.ts",
      "lib/geo/**/*.test.ts",
      "lib/import/**/*.test.ts",
    ],
  },
})
