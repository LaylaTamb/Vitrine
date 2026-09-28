import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Os testes cobrem `lib/domain/` e o acervo em memória da demonstração
// (`lib/demo/`) — TypeScript puro, sem React e sem Supabase. Nada aqui
// precisa de DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/domain/**/*.test.ts", "lib/demo/**/*.test.ts"],
  },
})
