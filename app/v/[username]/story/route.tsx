import { ImageResponse } from "next/og"
import { toString as qrSvg } from "qrcode"

import { StoryImage } from "@/components/social/story-image"
import { appOrigin } from "@/lib/actions/origin"
import { qrLink } from "@/lib/domain/qr"
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/domain/username"
import { remoteImageDataUri } from "@/lib/og/remote-image"
import { getProfileCard } from "@/lib/queries/public"

type Params = Promise<{ username: string }>

function decoded(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function notFound() {
  return new Response("Perfil não encontrado.", { status: 404 })
}

/**
 * `/v/<@>/story` — a imagem 9:16 do cartão, para postar no story. Pública
 * como o cartão (o banco só entrega as categorias públicas de fato). O QR
 * leva ao perfil, sem código de amizade: ele fica postado por 24 horas.
 */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { username: raw } = await params
  const username = normalizeUsername(decoded(raw))
  if (!USERNAME_PATTERN.test(username)) return notFound()

  const card = await getProfileCard(username)
  if (!card) return notFound()

  const link = qrLink(await appOrigin(), card.profile.username)
  const [svg, avatar] = await Promise.all([
    qrSvg(link, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#131315", light: "#ffffff" },
    }),
    remoteImageDataUri(card.profile.avatar_url),
  ])

  return new ImageResponse(
    (
      <StoryImage
        card={card}
        avatar={avatar}
        qr={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        site={link.replace(/^https?:\/\//, "")}
      />
    ),
    {
      width: 1080,
      height: 1920,
      // Sempre a versão de agora do cartão (e nada guardado no meio do caminho).
      headers: { "Cache-Control": "private, no-store" },
    }
  )
}
