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
