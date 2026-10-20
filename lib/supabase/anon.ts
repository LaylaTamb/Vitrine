import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { supabaseAnonKey, supabaseUrl } from "./env"

/**
 * Cliente sem sessão nenhuma (nem cookie): para o que o servidor faz sozinho,
 * como a rodada diária da Steam. Lê e grava só o que o papel `anon` pode — na
 * prática, as funções que abrem com o segredo do servidor.
 */
export function createAnonClient() {
  return createSupabaseClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
