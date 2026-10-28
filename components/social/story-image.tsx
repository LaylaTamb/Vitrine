import type { CardCategory, ProfileCard } from "@/lib/domain/card"
import { formatRating, itemCount } from "@/lib/domain/format"
import { coverBox } from "@/lib/domain/remote-image"
import { plainRichText } from "@/lib/domain/rich-text"

/**
 * A imagem do story (1080×1920) desenhada pelo `next/og`: o banner no topo
 * (migração 36), a foto por cima da borda dele, nome, @, bio, as categorias
 * do cartão com os 3 melhores itens e o QR do perfil (o link simples, sem
 * código de amizade). Só estilos inline — é o que o gerador entende; as cores
 * são as do tema escuro do app.
 */

/** A altura da faixa do banner (largura inteira: 1080). */
const BANNER_HEIGHT = 330
/** A foto: metade dela por cima do banner. */
const AVATAR = 176

export const COLORS = {
  bg: "#131315",
  surface: "#1d1d20",
  line: "#2b2b31",
  ink: "#ececef",
  muted: "#9a9aa4",
  faint: "#6e6e78",
  brand: "#b98cc2",
  wash: "rgba(185, 140, 194, 0.14)",
}

export const ELLIPSIS = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const

/** O gerador exige `display: flex` em todo bloco com mais de um filho. */
export const ROW = { display: "flex", alignItems: "center" } as const
export const COLUMN = { display: "flex", flexDirection: "column" } as const

/** A estrela em SVG (o caractere ★ não está na fonte do gerador). */
export function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={COLORS.brand}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  )
}

function CategoryBlock({ category, compact }: { category: CardCategory; compact: boolean }) {
  // Em duas colunas a letra diminui um pouco: cabe mais do nome de cada item.
  const itemSize = compact ? 28 : 32
  return (
    <div
      style={{
        ...COLUMN,
        width: compact ? 460 : 936,
        padding: compact ? "26px 26px" : "28px 32px",
        borderRadius: 28,
        backgroundColor: COLORS.surface,
        border: `2px solid ${COLORS.line}`,
      }}
    >
      <div style={{ ...ROW, gap: 14 }}>
        <div style={{ display: "flex", fontSize: 40 }}>{category.icon || "📁"}</div>
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: compact ? 34 : 38,
            color: COLORS.ink,
            ...ELLIPSIS,
          }}
        >
          {category.name}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 26, color: COLORS.faint, marginTop: 4 }}>
        {itemCount(category.total)}
      </div>
      <div style={{ ...COLUMN, gap: 10, marginTop: 18 }}>
        {category.top.length === 0 ? (
          <div style={{ display: "flex", fontSize: 30, color: COLORS.faint }}>Ainda sem itens.</div>
        ) : (
          category.top.map((item, index) => (
            <div key={item.id} style={{ ...ROW, gap: 12 }}>
              <div style={{ display: "flex", width: 22, fontSize: 26, color: COLORS.faint }}>
                {String(index + 1)}
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  fontSize: itemSize,
                  color: COLORS.muted,
                  ...ELLIPSIS,
                }}
              >
                {item.name}
              </div>
              {category.rating_enabled && item.rating !== null ? (
                <div style={{ ...ROW, gap: 6, fontSize: itemSize - 2, color: COLORS.brand }}>
                  <Star size={itemSize - 4} />
                  {formatRating(item.rating)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function StoryImage({
  card,
  avatar,
  banner,
  bannerSize,
  qr,
  site,
}: {
  card: ProfileCard
  /** A foto já como `data:` (ou `null`: usa a inicial). */
  avatar: string | null
  /** O banner já como `data:` (ou `null`: a faixa fica na cor da casa). */
  banner: string | null
  /**
   * O tamanho do banner (`imageSizeOf`): o gerador não entende
   * `object-position`, então o recorte é calculado (`coverBox`). Sem ele, centrado.
   */
  bannerSize: { width: number; height: number } | null
  /** O QR do perfil como `data:image/svg+xml`. */
  qr: string
  /** O endereço do perfil sem `https://`, escrito embaixo do QR. */
  site: string
}) {
  const { profile, bio, categories } = card
  const name = profile.display_name || profile.username
  // Até 2 categorias, uma por linha; mais que isso, duas colunas (senão uma
  // bio longa com 5 ou 6 categorias não cabe na altura). Com 6, são 3 linhas de
  // 2 — a mesma altura de 5.
  const compact = categories.length > 2
  const bannerBox = bannerSize
    ? coverBox(bannerSize, { width: 1080, height: BANNER_HEIGHT }, card.banner?.position ?? 50)
    : null

  return (
    <div
      style={{
        ...COLUMN,
        width: 1080,
        height: 1920,
        backgroundColor: COLORS.bg,
        color: COLORS.ink,
      }}
    >
      {/* O banner de ponta a ponta; sem ele, a faixa na cor da casa. */}
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 1080,
          height: BANNER_HEIGHT,
          overflow: "hidden",
          backgroundImage: "linear-gradient(135deg, #3a2a40 0%, #221a26 55%, #1d1d20 100%)",
        }}
      >
        {banner && bannerBox ? (
          // eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página
          <img
            src={banner}
            width={bannerBox.width}
            height={bannerBox.height}
            alt=""
            style={{ position: "absolute", left: bannerBox.left, top: bannerBox.top }}
          />
        ) : banner ? (
          // eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página
          <img
            src={banner}
            width={1080}
            height={BANNER_HEIGHT}
            alt=""
            style={{ objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            ...ROW,
            position: "absolute",
            top: 48,
            left: 64,
            gap: 12,
            padding: "10px 22px",
            borderRadius: 999,
            backgroundColor: "rgba(19, 19, 21, 0.72)",
            fontSize: 32,
            color: COLORS.brand,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: COLORS.brand,
            }}
          />
          Vitrine
        </div>
      </div>

      <div style={{ ...COLUMN, flex: 1, padding: "0 72px 64px" }}>
        <div style={{ ...ROW, alignItems: "flex-end", gap: 32, marginTop: -(AVATAR / 2) }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página
            <img
              src={avatar}
              width={AVATAR}
              height={AVATAR}
              alt=""
              style={{
                borderRadius: AVATAR / 2,
                objectFit: "cover",
                border: `8px solid ${COLORS.bg}`,
              }}
            />
          ) : (
            <div
              style={{
                ...ROW,
                justifyContent: "center",
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR / 2,
                backgroundColor: "#2a2230",
                border: `8px solid ${COLORS.bg}`,
                color: COLORS.brand,
                fontSize: 84,
              }}
            >
              {(name.trim()[0] ?? "?").toUpperCase()}
            </div>
          )}
          <div style={{ ...COLUMN, flex: 1, minWidth: 0, paddingBottom: 6 }}>
            {/* O nome quebra linha em vez de ser cortado (até 80 caracteres). */}
            <div style={{ display: "flex", fontSize: 56, lineHeight: 1.12, color: COLORS.ink }}>
              {name}
            </div>
            <div style={{ display: "flex", fontSize: 36, color: COLORS.muted, marginTop: 8 }}>
              @{profile.username}
            </div>
          </div>
        </div>

        {bio ? (
          <div
            style={{
              display: "flex",
              fontSize: 36,
              lineHeight: 1.38,
              color: COLORS.ink,
              marginTop: 32,
            }}
          >
            {plainRichText(bio)}
          </div>
        ) : null}

        {categories.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 36 }}>
            {categories.map((category) => (
              <CategoryBlock key={category.id} category={category} compact={compact} />
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ ...ROW, gap: 40 }}>
          <div
            style={{ display: "flex", padding: 14, borderRadius: 26, backgroundColor: "#ffffff" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página */}
            <img src={qr} width={208} height={208} alt="" />
          </div>
          <div style={{ ...COLUMN, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 44, color: COLORS.ink }}>
              Me acha no Vitrine
            </div>
            <div style={{ display: "flex", fontSize: 32, color: COLORS.brand, marginTop: 12 }}>
              {site}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: COLORS.faint, marginTop: 16 }}>
              Aponte a câmera para o QR
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
