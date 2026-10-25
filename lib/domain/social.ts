/**
 * Seguir, Amigos e notificações (migrações 14, 21 e 22). Seguir não pede
 * aceite; Amigos = os dois se seguem.
 */

/** A relação de quem vê com o dono do perfil. */
export interface Relation {
  /** Eu sigo essa pessoa. */
  following: boolean
  /** Essa pessoa me segue. */
  followsMe: boolean
}

/** Os dois se seguem. */
export function areFriends(relation: Relation): boolean {
  return relation.following && relation.followsMe
}

/** O texto do botão de seguir. */
export function followButtonLabel(relation: Relation): string {
  if (relation.following) return "Seguindo"
  return relation.followsMe ? "Seguir de volta" : "Seguir"
}

/** Uma linha de `notifications`, já com o perfil de quem causou. */
export interface NotificationView {
  id: number
  type: string
  read_at: string | null
  created_at: string
  payload: Record<string, unknown>
  /** `id`: para o "Seguir de volta" dos Avisos. */
  actor: {
    id?: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

/** O texto de uma notificação, em português. */
export function notificationText(
  notification: Pick<NotificationView, "type" | "payload" | "actor">
): string {
  const who = notification.actor ? `@${notification.actor.username}` : "Alguém"
  switch (notification.type) {
    case "new_follower":
      return notification.payload.mutual === true
        ? `${who} seguiu você de volta — agora vocês são amigos.`
        : `${who} começou a seguir você.`
    case "qr_friend":
      return `Você e ${who} viraram amigos pelo QR.`
    case "import_done":
      return importDoneText(notification.payload)
    case "match_invite": {
      const size = count(notification.payload.size)
      return size > 2
        ? `${who} chamou você para um match com ${size} pessoas.`
        : `${who} chamou você para um match.`
    }
    case "match_canceled":
      return `${who} recusou o match, e ele foi cancelado.`
    case "match_ready":
      return "Todo mundo aceitou: o seu match está pronto."
    default:
      return `${who} fez algo novo no Vitrine.`
  }
}

function count(value: unknown): number {
  return typeof value === "number" && value > 0 ? Math.trunc(value) : 0
}

/** "Importação do Google Maps concluída: 245 itens novos (120 ainda sem lugar no mapa)." */
function importDoneText(payload: Record<string, unknown>): string {
  const from = payload.source === "letterboxd" ? "do Letterboxd" : "do Google Maps"
  const added = count(payload.added)
  const pending = count(payload.pending)
  const what =
    added === 0 ? "nada novo" : added === 1 ? "1 item novo" : `${added} itens novos`
  const rest =
    pending > 0
      ? ` (${pending === 1 ? "1 ainda sem lugar" : `${pending} ainda sem lugar`} no mapa)`
      : ""
  return `Importação ${from} concluída: ${what}${rest}.`
}

/** Para onde o toque numa notificação leva. */
export function notificationHref(
  notification: Pick<NotificationView, "type" | "actor">,
  profileHref: (username: string) => string
): string {
  if (notification.type.startsWith("match_")) return "/matches"
  // A importação caiu nas suas Coleções, que moram no perfil.
  if (notification.type === "import_done") return "/perfil"
  return notification.actor ? profileHref(notification.actor.username) : "/"
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
})

/** "agora", "há 5 min", "há 3 h", "há 2 dias" e, depois de uma semana, a data. */
export function timeAgo(iso: string, now: Date): string {
  const elapsed = now.getTime() - new Date(iso).getTime()
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return "agora"
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)} h`
  const days = Math.floor(elapsed / DAY)
  if (days < 7) return days === 1 ? "há 1 dia" : `há ${days} dias`
  return DATE.format(new Date(iso))
}
