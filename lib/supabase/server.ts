import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { supabaseAnonKey, supabaseUrl } from "./env"

/**
 * Cliente para Server Components e Server Actions.
 *
 * A sessão vive em cookies httpOnly gerenciados pelo `@supabase/ssr` — nada de
 * token em localStorage. Server Component não pode escrever cookie, então o
 * `setAll` engole o erro: quem renova a sessão é o middleware.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Chamado de um Server Component: ignorar é o comportamento correto.
        }
      },
    },
  })
}
