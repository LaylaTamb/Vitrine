import { COLORS, COLUMN, ELLIPSIS, ROW, Star } from "@/components/social/story-image"
import type { BlendHighlights, BlendPick } from "@/lib/domain/blend"
import { BLEND_KIND_LABEL } from "@/lib/domain/blend"
import { formatRating, plural } from "@/lib/domain/format"
import type { MatchMember } from "@/lib/domain/match"
import { coverBox } from "@/lib/domain/remote-image"

/** As fotos do topo e a imagem do item que une. */
const AVATAR = 150
const ITEM_W = 200
const ITEM_H = 250

/**
 * A imagem do story de um match (1080×1920), desenhada pelo `next/og` com o
 * mesmo visual do story do perfil: as fotos de quem está no match, a %, o
 * porquê, a categoria e o item que unem vocês e o começo da lista de hoje.
 * Sem QR: o match é só de quem está nele.
 */
export function MatchStoryImage({
  members,
  avatars,
  people,
  percent,
  why,
  highlights,
  itemImage,
  itemSize,
  itemPosition,
  picks,
  site,
}: {
  members: MatchMember[]
  /** As fotos já como `data:` (ou `null`: a inicial), na ordem de `members`. */
  avatars: (string | null)[]
  /** "@a e @b". */
  people: string
  percent: number | null
  why: string
  highlights: BlendHighlights
  /** A imagem do item que une, já como `data:`. */
  itemImage: string | null
  /** O tamanho dela (`imageSizeOf`): o recorte é calculado à mão (`coverBox`). */
  itemSize: { width: number; height: number } | null
  /** A posição vertical do enquadramento do item (0 a 100). */
  itemPosition: number
  /** O começo da lista de hoje. */
  picks: BlendPick[]
  /** O endereço do Vitrine sem `https://`. */
  site: string
}) {
  const colorOf = new Map(members.map((member) => [member.userId, member.color]))
  const nameOf = new Map(members.map((member) => [member.userId, member.username]))
  const box = itemSize ? coverBox(itemSize, { width: ITEM_W, height: ITEM_H }, itemPosition) : null
  const item = highlights.item

  return (
    <div
      style={{
        ...COLUMN,
        width: 1080,
        height: 1920,
        padding: "64px 72px",
        backgroundColor: COLORS.bg,
        backgroundImage: "linear-gradient(180deg, #2a2030 0%, #131315 45%)",
        color: COLORS.ink,
      }}
    >
      <div style={{ ...ROW, gap: 12, fontSize: 32, color: COLORS.brand }}>
        <div
          style={{
            display: "flex",
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: COLORS.brand,
          }}
        />
        Vitrine · Match
      </div>

      <div style={{ ...ROW, justifyContent: "center", marginTop: 56 }}>
        {members.slice(0, 4).map((member, index) => {
          const avatar = avatars[index]
          const ring = { border: `8px solid ${member.color}`, marginLeft: index === 0 ? 0 : -36 }
          return avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página
            <img
              key={member.userId}
              src={avatar}
              width={AVATAR}
              height={AVATAR}
              alt=""
              style={{ borderRadius: AVATAR / 2, objectFit: "cover", ...ring }}
            />
          ) : (
            <div
              key={member.userId}
              style={{
                ...ROW,
                justifyContent: "center",
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR / 2,
                backgroundColor: "#2a2230",
                color: COLORS.brand,
                fontSize: 64,
                ...ring,
              }}
            >
              {(member.username[0] ?? "?").toUpperCase()}
            </div>
          )
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          fontSize: 40,
          color: COLORS.ink,
          marginTop: 28,
        }}
      >
        {people}
      </div>

      <div style={{ ...COLUMN, alignItems: "center", marginTop: 36 }}>
        <div style={{ display: "flex", fontSize: 220, lineHeight: 1, color: COLORS.brand }}>
          {percent === null ? "—" : `${percent}%`}
        </div>
        <div style={{ display: "flex", fontSize: 40, color: COLORS.ink, marginTop: 8 }}>
          de compatibilidade
        </div>
        <div
          style={{
            display: "flex",
            textAlign: "center",
            fontSize: 30,
            lineHeight: 1.35,
            color: COLORS.muted,
            marginTop: 20,
            maxWidth: 860,
          }}
        >
          {why}
        </div>
      </div>

      {/* O espaço que sobra vai metade aqui, metade antes do rodapé. */}
      <div style={{ display: "flex", flex: 1, minHeight: 48 }} />

      <div style={{ ...ROW, alignItems: "stretch", gap: 20 }}>
        {highlights.family ? (
          <div
            style={{
              ...COLUMN,
              flex: 1,
              padding: "28px 30px",
              borderRadius: 28,
              backgroundColor: COLORS.surface,
              border: `2px solid ${COLORS.line}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 24, color: COLORS.faint }}>
              A CATEGORIA QUE UNE VOCÊS
            </div>
            <div style={{ display: "flex", fontSize: 64, marginTop: 18 }}>
              {highlights.family.icon || "📁"}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 44,
                color: COLORS.ink,
                marginTop: 10,
                ...ELLIPSIS,
              }}
            >
              {highlights.family.name}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: COLORS.muted, marginTop: 8 }}>
              {plural(highlights.family.common, "coisa em comum", "coisas em comum")}
            </div>
          </div>
        ) : null}
        {item ? (
          <div
            style={{
              ...ROW,
              alignItems: "flex-start",
              flex: 1.4,
              gap: 22,
              padding: "28px 30px",
              borderRadius: 28,
              backgroundColor: COLORS.surface,
              border: `2px solid ${COLORS.line}`,
            }}
          >
            <div
              style={{
                display: "flex",
                position: "relative",
                width: ITEM_W,
                height: ITEM_H,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: 18,
                backgroundColor: "#2a2230",
              }}
            >
              {itemImage && box ? (
                // eslint-disable-next-line @next/next/no-img-element -- desenhada pelo next/og, não é página
                <img
                  src={itemImage}
                  width={box.width}
                  height={box.height}
                  alt=""
                  style={{ position: "absolute", left: box.left, top: box.top }}
                />
              ) : (
                <div
                  style={{
                    ...ROW,
                    justifyContent: "center",
                    width: ITEM_W,
                    height: ITEM_H,
                    fontSize: 80,
                    color: COLORS.brand,
                  }}
                >
                  {(item.item.name[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ ...COLUMN, flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", fontSize: 24, color: COLORS.faint }}>
                O ITEM QUE UNE VOCÊS
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  lineHeight: 1.2,
                  color: COLORS.ink,
                  marginTop: 14,
                  maxHeight: 140,
                  overflow: "hidden",
                }}
              >
                {item.item.name}
              </div>
              <div style={{ ...COLUMN, gap: 8, marginTop: 14 }}>
                {item.owners.slice(0, 3).map((owner) => (
                  <div
                    key={owner.userId}
                    style={{ ...ROW, gap: 10, fontSize: 26, color: COLORS.muted }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: colorOf.get(owner.userId) ?? COLORS.brand,
                      }}
                    />
                    <div style={{ display: "flex", ...ELLIPSIS, maxWidth: 260 }}>
                      @{nameOf.get(owner.userId) ?? "alguém"}
                    </div>
                    <Star size={24} />
                    {formatRating(owner.rating)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {picks.length > 0 ? (
        <div
          style={{
            ...COLUMN,
            marginTop: 24,
            padding: "28px 32px",
            borderRadius: 28,
            backgroundColor: COLORS.surface,
            border: `2px solid ${COLORS.line}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 24, color: COLORS.faint }}>NA LISTA DE HOJE</div>
          <div style={{ ...COLUMN, gap: 14, marginTop: 18 }}>
            {picks.map((pick, index) => (
              <div key={pick.key} style={{ ...ROW, gap: 16 }}>
                <div style={{ display: "flex", width: 30, fontSize: 28, color: COLORS.faint }}>
                  {String(index + 1)}
                </div>
                <div
                  style={{ display: "flex", flex: 1, fontSize: 32, color: COLORS.ink, ...ELLIPSIS }}
                >
                  {pick.item.name}
                </div>
                <div style={{ ...ROW, gap: 6 }}>
                  {pick.owners.map((owner) => (
                    <div
                      key={owner.userId}
                      style={{
                        display: "flex",
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: colorOf.get(owner.userId) ?? COLORS.brand,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", width: 170, fontSize: 24, color: COLORS.muted }}>
                  {BLEND_KIND_LABEL[pick.kind]}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flex: 1, minHeight: 48 }} />

      <div style={{ ...COLUMN, alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 38, color: COLORS.ink }}>
          Faça o match de vocês no Vitrine
        </div>
        <div style={{ display: "flex", fontSize: 32, color: COLORS.brand, marginTop: 12 }}>
          {site}
        </div>
      </div>
    </div>
  )
}
