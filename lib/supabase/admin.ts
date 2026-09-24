import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { supabaseServiceRoleKey, supabaseUrl } from "./env"

/**
 * Cliente com a chave `service_role`: ignora RLS inteira. Só a rota `/demo`
 * usa isto — nunca importe em código que roda no navegador ou em qualquer
 * outra Server Action.
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
