import type { CardCategory, ProfileCard } from "@/lib/domain/card"
import { formatRating, itemCount } from "@/lib/domain/format"

/**
 * A imagem do story (1080×1920) desenhada pelo `next/og`: foto, nome, @, bio,
 * as categorias do cartão com os 3 melhores itens e o QR do perfil (o link
 * simples, sem código de amizade). Só estilos inline — é o que o gerador
 * entende; as cores são as do tema escuro do app.
 */

const COLORS = {
  bg: "#131315",
  surface: "#1d1d20",
  line: "#2b2b31",
  ink: "#ececef",
  muted: "#9a9aa4",
  faint: "#6e6e78",
  brand: "#b98cc2",
  wash: "rgba(185, 140, 194, 0.14)",
}

const ELLIPSIS = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const

/** O gerador exige `display: flex` em todo bloco com mais de um filho. */
const ROW = { display: "flex", alignItems: "center" } as const
const COLUMN = { display: "flex", flexDirection: "column" } as const

/** A estrela em SVG (o caractere ★ não está na fonte do gerador). */
function Star({ size }: { size: number }) {
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
        width: compact ? 452 : 920,
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
          <div style={{ display: "flex", fontSize: 30, color: COLORS.faint }}>
            Ainda sem itens.
          </div>
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
  qr,
  site,
}: {
  card: ProfileCard
  /** A foto já como `data:` (ou `null`: usa a inicial). */
  avatar: string | null
  /** O QR do perfil como `data:image/svg+xml`. */
  qr: string
  /** O endereço do perfil sem `https://`, escrito embaixo do QR. */
  site: string
}) {
  const { profile, bio, categories } = card
  const name = profile.display_name || profile.username
  // Até 2 categorias, uma por linha; mais que isso, duas colunas (senão uma
  // bio longa com 5 categorias não cabe na altura).
  const compact = categories.length > 2

  return (
    <div
      style={{
        ...COLUMN,
        width: 1080,
        height: 1920,
        padding: "96px 80px 88px",
        backgroundColor: COLORS.bg,
        backgroundImage: `linear-gradient(180deg, #221a26 0%, ${COLORS.bg} 38%)`,
        color: COLORS.ink,
      }}
    >
      <div style={{ ...ROW, gap: 14, fontSize: 34, color: COLORS.brand }}>
        <div
          style={{
            display: "flex",
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: COLORS.brand,
          }}
        />
        Vitrine
      </div>

      <div style={{ ...ROW, gap: 36, marginTop: 64 }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página
          <img
            src={avatar}
            width={184}
            height={184}
            alt=""
            style={{ borderRadius: 92, objectFit: "cover", border: `4px solid ${COLORS.line}` }}
          />
        ) : (
          <div
            style={{
              ...ROW,
              justifyContent: "center",
              width: 184,
              height: 184,
              borderRadius: 92,
              backgroundColor: COLORS.wash,
              color: COLORS.brand,
              fontSize: 88,
            }}
          >
            {(name.trim()[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div style={{ ...COLUMN, flex: 1, minWidth: 0 }}>
          {/* O nome quebra linha em vez de ser cortado (até 80 caracteres). */}
          <div style={{ display: "flex", fontSize: 60, lineHeight: 1.12, color: COLORS.ink }}>
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 38, color: COLORS.muted, marginTop: 10 }}>
            @{profile.username}
          </div>
        </div>
      </div>

      {bio ? (
        <div
          style={{ display: "flex", fontSize: 38, lineHeight: 1.4, color: COLORS.ink, marginTop: 48 }}
        >
          {bio}
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 56 }}>
          {categories.map((category) => (
            <CategoryBlock key={category.id} category={category} compact={compact} />
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ ...ROW, gap: 40 }}>
        <div style={{ display: "flex", padding: 16, borderRadius: 28, backgroundColor: "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página */}
          <img src={qr} width={232} height={232} alt="" />
        </div>
        <div style={{ ...COLUMN, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 44, color: COLORS.ink }}>Me acha no Vitrine</div>
          <div style={{ display: "flex", fontSize: 32, color: COLORS.brand, marginTop: 12 }}>
            {site}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: COLORS.faint, marginTop: 16 }}>
            Aponte a câmera para o QR
          </div>
        </div>
      </div>
    </div>
  )
}
