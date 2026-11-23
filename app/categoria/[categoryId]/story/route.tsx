import { ImageResponse } from "next/og"
import { toString as qrSvg } from "qrcode"

import { ListStoryImage, type StoryPhoto } from "@/components/category/list-story-image"
import { appOrigin } from "@/lib/actions/origin"
import { itemsAt, resolveFolderId } from "@/lib/domain/entry-folders"
import {
  applyCategoryFilter,
  categoryFilterFromParams,
  isCategoryFilterActive,
} from "@/lib/domain/filter"
import { itemCount } from "@/lib/domain/format"
import { normalizeGridSize } from "@/lib/domain/grid-size"
import { storyFilterChips, storyItems, storyModeOf, storyPlan } from "@/lib/domain/list-story"
import { imageSizeOf } from "@/lib/domain/remote-image"
import type { Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"
import { remoteImageDataUri } from "@/lib/og/remote-image"
import { getCategoryPage } from "@/lib/queries/category"
import { getPublicCategory } from "@/lib/queries/public"
import { getSessionUser } from "@/lib/queries/session"

type Params = Promise<{ categoryId: string }>

/** Fotos buscadas por imagem, no máximo (o tier list P pode pedir 48): o resto vira a inicial. */
const MAX_PHOTOS = 32

function notFound() {
  return new Response("Lista não encontrada.", { status: 404 })
}

/** A foto já como `data:`, com o tamanho lido do próprio arquivo (o recorte é feito na mão). */
async function photoOf(url: string | null): Promise<StoryPhoto | null> {
  const src = await remoteImageDataUri(url)
  if (!src) return null
  const size = imageSizeOf(Buffer.from(src.slice(src.indexOf(",") + 1), "base64"))
  return size ? { src, size } : null
}

/**
 * `/categoria/<id>/story` — a imagem 9:16 da lista, do jeito que ela está na
 * tela: `?vista=` (grid, list, tier), `?tamanho=` (small, medium, large),
 * `?pasta=` e o filtro com os mesmos parâmetros da página (`q`, `min`, `max`,
 * `tags`, `modo`, `ordem`).
 *
 * Gera quem já pode ver a lista: com login, a leitura da página (a RLS
 * decide); sem login, só a categoria pública (`public_category`). O QR leva à
 * categoria (na subpasta aberta) e só abre para quem pode vê-la.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { categoryId } = await params
  const query = Object.fromEntries(new URL(request.url).searchParams)
  const user = await getSessionUser()
  const data = user ? await getCategoryPage(categoryId) : await getPublicCategory(categoryId)
  const category = data?.category
  if (!data || !category) return notFound()

  const tagsById = new Map<string, Tag>(data.tags.map((tag) => [tag.id, tag]))
  const views = data.entries.map((entry) =>
    toView(entry, category.estrutura, tagsById, category.name)
  )
  const folderId = resolveFolderId(data.entryFolders, query.pasta ?? null)
  const folder = data.entryFolders.find((item) => item.id === folderId) ?? null
  const level = itemsAt(views, folderId)
  const filter = categoryFilterFromParams(query, category)
  const list = applyCategoryFilter(level, filter)

  const size = normalizeGridSize(query.tamanho)
  const plan = storyPlan(storyModeOf(query.vista, category.rating_enabled), size, list)
  const fetched = storyItems(plan).slice(0, MAX_PHOTOS)

  const origin = await appOrigin()
  const link = `${origin}/categoria/${category.id}${folderId ? `?pasta=${folderId}` : ""}`
  const [svg, avatar, photos] = await Promise.all([
    qrSvg(link, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#131315", light: "#ffffff" },
    }),
    remoteImageDataUri(data.owner?.avatar_url),
    Promise.all(fetched.map((view) => photoOf(view.imageUrl))),
  ])

  const active = isCategoryFilterActive(filter)
  return new ImageResponse(
    <ListStoryImage
      name={category.name}
      icon={category.icon}
      folderName={folder?.name ?? null}
      username={data.owner?.username ?? "vitrine"}
      avatar={avatar}
      countLabel={active ? `${list.length} de ${itemCount(level.length)}` : itemCount(level.length)}
      chips={storyFilterChips(filter, data.tags, category.rating_enabled)}
      ratingEnabled={category.rating_enabled}
      plan={plan}
      size={size}
      photos={Object.fromEntries(fetched.map((view, index) => [view.id, photos[index]]))}
      qr={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
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
