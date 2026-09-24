/**
 * As duas variáveis que o app inteiro precisa. Falhar aqui, com uma mensagem
 * clara, é melhor do que um "fetch failed" três camadas adiante.
 */

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL não está definida. Copie .env.example para .env.local e preencha."
    )
  }
  return value.replace(/\/+$/, "")
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida. Copie .env.example para .env.local e preencha."
    )
  }
  return value
}

/**
 * A chave `service_role`: ignora RLS inteira. Só existe no servidor, nunca
 * `NEXT_PUBLIC_*`, e só é usada pela rota `/demo` (login automático da conta
 * de demonstração, sem OTP).
 */
export function supabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está definida. Pegue em Project Settings → API Keys → service_role no painel do Supabase."
    )
  }
  return value
}
