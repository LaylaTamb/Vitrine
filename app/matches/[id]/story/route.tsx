import { ImageResponse } from "next/og"

import { MatchStoryImage } from "@/components/match/match-story-image"
import { appOrigin } from "@/lib/actions/origin"
import {
  blendDay,
  blendHighlights,
  blendPeopleLabel,
  blendTaste,
  buildBlend,
  tasteWhy,
} from "@/lib/domain/blend"
import { imageSizeOf } from "@/lib/domain/remote-image"
import { remoteImageDataUri } from "@/lib/og/remote-image"
import { getMatchBlendPool, getMatchById } from "@/lib/queries/matches"
import { getSessionUser } from "@/lib/queries/session"

type Params = Promise<{ id: string }>

/** Quantos itens da lista de hoje vão no story. */
const STORY_PICKS = 7

function notFound() {
  return new Response("Match não encontrado.", { status: 404 })
}

/**
 * `/matches/<id>/story` — a imagem 9:16 do match, para postar no story. Só
 * quem está no match gera (a RLS e a `match_blend_pool`), e ela mostra só o
 * que todos do match podem ver — o mesmo da lista de hoje.
 */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params
  if (!(await getSessionUser())) return new Response("Entre na sua conta.", { status: 401 })

  const match = await getMatchById(id)
  if (!match || match.status !== "ready") return notFound()
  const { pool } = await getMatchBlendPool(match.id)
  if (!pool) return notFound()

  const now = new Date()
  const memberIds = match.members.map((member) => member.userId)
  const taste = blendTaste(pool, memberIds)
  const highlights = blendHighlights(pool)
  const picks = buildBlend({ pool, memberIds, seed: `${match.id}:${blendDay(now)}`, now })
  const duo = taste.pairs.length === 1 ? taste.pairs[0] : null

  const [avatars, itemImage, origin] = await Promise.all([
    Promise.all(match.members.slice(0, 4).map((member) => remoteImageDataUri(member.avatarUrl))),
    remoteImageDataUri(highlights.item?.item.imageUrl),
    appOrigin(),
  ])
  // O tamanho da imagem, lido do próprio arquivo: o recorte é feito na mão.
  const itemSize = itemImage
    ? imageSizeOf(Buffer.from(itemImage.slice(itemImage.indexOf(",") + 1), "base64"))
    : null

  return new ImageResponse(
    <MatchStoryImage
      members={match.members}
      avatars={avatars}
      people={blendPeopleLabel(match.members.map((member) => member.username))}
      percent={taste.percent}
      why={duo ? tasteWhy(duo) : `A média dos ${taste.pairs.length} pares do grupo.`}
      highlights={highlights}
      itemImage={itemImage}
      itemSize={itemSize}
      itemPosition={highlights.item?.item.imageDisplay?.y ?? 50}
      picks={picks.slice(0, STORY_PICKS)}
      site={origin.replace(/^https?:\/\//, "")}
    />,
    {
      width: 1080,
      height: 1920,
      // Sempre a lista de agora (e nada guardado no meio do caminho).
      headers: { "Cache-Control": "private, no-store" },
    }
  )
}
