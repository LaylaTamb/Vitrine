import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Os testes cobrem `lib/domain/`, o acervo em memória da demonstração
// (`lib/demo/`) e o tratamento das respostas da Geoapify (`lib/geo/`, só as
// funções puras de `parse.ts`) — TypeScript puro, sem React, sem Supabase e
// sem rede. Nada aqui precisa de DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/domain/**/*.test.ts", "lib/demo/**/*.test.ts", "lib/geo/**/*.test.ts"],
  },
})
