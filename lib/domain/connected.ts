/**
 * Aplicativos conectados (Steam, migração 24; Letterboxd, migração 39): o
 * que vale para os dois — quando atualizar ao abrir a categoria, e as frases.
 */

export type ConnectedProvider = "steam" | "letterboxd"

export const PROVIDER_LABELS: Record<ConnectedProvider, string> = {
  steam: "Steam",
  letterboxd: "Letterboxd",
}

/** Abrir a categoria atualiza sozinho se a última tentativa foi há mais que isto. */
export const SYNC_ON_OPEN_MINUTES = 60

/** Passou da hora de atualizar ao abrir? Nunca tentou = sim. */
export function isSyncDue(
  lastAttemptAt: string | null,
  now: Date,
  minutes = SYNC_ON_OPEN_MINUTES
): boolean {
  if (!lastAttemptAt) return true
  const last = Date.parse(lastAttemptAt)
  if (!Number.isFinite(last)) return true
  return now.getTime() - last >= minutes * 60_000
}

export const LETTERBOXD_NOT_READY =
  "A conexão com o Letterboxd ainda não está no banco: rode supabase/39_letterboxd_feed.sql no SQL Editor do Supabase (depois do 24, com o segredo do servidor gravado)."

export const LETTERBOXD_NOT_FOUND =
  "Não achei esse @ no Letterboxd. Confira o nome (é o que aparece no endereço do seu perfil)."

/** O resultado de sincronizar o Letterboxd, em uma frase. */
export function letterboxdSummary(created: number, updated: number): string {
  if (created === 0 && updated === 0) return "Tudo em dia: nenhum filme novo."
  const parts = []
  if (created > 0) parts.push(created === 1 ? "1 filme novo" : `${created} filmes novos`)
  if (updated > 0) parts.push(updated === 1 ? "1 atualizado" : `${updated} atualizados`)
  return `${parts.join(" e ")}.`
}
