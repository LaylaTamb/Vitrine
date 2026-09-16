import { createBrowserClient } from "@supabase/ssr"

import { supabaseAnonKey, supabaseUrl } from "./env"

/**
 * Cliente do navegador. Usado só pelas poucas ilhas que precisam falar com o
 * Supabase direto — o login, basicamente. Nenhuma leitura de primeira pintura
 * passa por aqui: isso é trabalho do Server Component.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey())
}
