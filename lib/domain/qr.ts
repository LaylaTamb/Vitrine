/**
 * QR pessoal (migração 22): o QR da tela "Meu QR" leva ao perfil com um
 * código que vale 5 minutos; quem abre o link logado vira amigo do dono na
 * hora (os dois passam a se seguir). Quem garante é o banco (`redeem_qr`);
 * aqui fica o formato do link e as frases.
 */

import { profilePath, USERNAME_PATTERN } from "./username"

/** O código que o banco devolve: 64 caracteres hexadecimais. */
export const QR_TOKEN_PATTERN = /^[0-9a-f]{64}$/

/**
 * De quanto em quanto tempo a tela troca o código. Ele vale 5 minutos: o
 * anterior ainda funciona enquanto alguém termina de escanear.
 */
export const QR_REFRESH_MS = 4 * 60_000

/** O erro de usar o QR antes de a migração 22 rodar. */
export const QR_NOT_READY =
  "O QR ainda não está no banco: rode supabase/22_qr_tokens.sql no SQL Editor do Supabase (antes dele, o 14 e o 21)."

export function isQrToken(value: unknown): value is string {
  return typeof value === "string" && QR_TOKEN_PATTERN.test(value)
}

/** O endereço que vai no QR: o perfil e, para virar amigo, o código. */
export function qrLink(origin: string, username: string, token?: string): string {
  const base = `${origin.replace(/\/+$/, "")}${profilePath(username)}`
  return token ? `${base}?qr=${token}` : base
}

/**
 * O que um QR lido aponta, como caminho para abrir aqui (`/v/ana?qr=…`) —
 * só se for um perfil DESTE site (`origins`: os endereços aceitos). Qualquer
 * outra coisa (outro site, outra página, texto solto) devolve `null`: o
 * leitor nunca leva a pessoa para fora do Vitrine.
 */
export function scannedProfilePath(text: string, origins: string[]): string | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return null
  }
  const accepted = origins.flatMap((origin) => {
    try {
      return [new URL(origin).origin]
    } catch {
      return []
    }
  })
  if (!accepted.includes(url.origin)) return null

  const match = /^\/v\/([^/]+)\/?$/.exec(url.pathname)
  if (!match) return null
  const username = decodeURIComponent(match[1]).toLowerCase()
  if (!USERNAME_PATTERN.test(username)) return null

  const token = url.searchParams.get("qr")
  return isQrToken(token) ? `${profilePath(username)}?qr=${token}` : profilePath(username)
}

/** O que `redeem_qr` responde. */
export const REDEEM_STATUSES = ["friends", "already_friends", "self", "blocked", "invalid"] as const

export type RedeemStatus = (typeof REDEEM_STATUSES)[number]

export function isRedeemStatus(value: unknown): value is RedeemStatus {
  return typeof value === "string" && (REDEEM_STATUSES as readonly string[]).includes(value)
}

export interface RedeemMessage {
  title: string
  description: string
  /** `true` = deu certo (ou já estava certo); `false` = algo a fazer. */
  good: boolean
}

/** O que a tela diz depois de abrir o link de um QR. */
export function redeemMessage(status: RedeemStatus, username: string): RedeemMessage {
  switch (status) {
    case "friends":
      return {
        title: "Agora vocês são amigos",
        description: `Você e @${username} se seguem: o que for de Amigos aparece para os dois.`,
        good: true,
      }
    case "already_friends":
      return {
        title: "Vocês já são amigos",
        description: `Você e @${username} já se seguem.`,
        good: true,
      }
    case "self":
      return {
        title: "Este é o seu QR",
        description: "Mostre para alguém escanear com a câmera do celular.",
        good: true,
      }
    case "blocked":
      return {
        title: `Você bloqueou @${username}`,
        description: "Desbloqueie aqui no perfil para poderem virar amigos.",
        good: false,
      }
    case "invalid":
      return {
        title: "Este QR não vale mais",
        description:
          "O código troca a cada poucos minutos. Peça para a pessoa abrir o QR de novo e escaneie outra vez.",
        good: false,
      }
  }
}
