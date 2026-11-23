/* eslint-disable @next/next/no-img-element -- desenhada pelo next/og, não é página */
import { COLORS, COLUMN, ELLIPSIS, ROW, Star } from "@/components/social/story-image"
import { formatRating, itemCount } from "@/lib/domain/format"
import type { GridSize } from "@/lib/domain/grid-size"
import {
  STORY_BODY,
  STORY_GRID,
  STORY_LIST,
  STORY_TIER,
  storyGridCell,
  storyTierThumb,
  UNRATED_LABEL,
  type StoryPlan,
} from "@/lib/domain/list-story"
import { framedBox } from "@/lib/domain/remote-image"
import { TIER_INK } from "@/lib/domain/tiers"
import type { EntryView } from "@/lib/domain/types"

/** A foto de um item, já como `data:`, com o tamanho lido do arquivo (para o recorte). */
export interface StoryPhoto {
  src: string
  size: { width: number; height: number }
}

const AVATAR = 76
const QR = 200
const PHOTO_BG = "#2a2230"

/**
 * A imagem da lista (1080×1920), desenhada pelo `next/og`: quem fez, o nome
 * da categoria (e da subpasta), o recorte do filtro, os itens em Grade, Lista
 * ou Tier list do tamanho escolhido e, embaixo, o QR que abre a lista no
 * Vitrine. As contas (quantos cabem, o "+N") são do `lib/domain/list-story`.
 * Só estilos inline: é o que o gerador entende.
 */
export function ListStoryImage({
  name,
  icon,
  folderName,
  username,
  avatar,
  countLabel,
  chips,
  ratingEnabled,
  plan,
  size,
  photos,
  qr,
  site,
}: {
  name: string
  icon: string | null
  /** A subpasta aberta, se houver. */
  folderName: string | null
  username: string
  avatar: string | null
  /** "24 itens" ou "8 de 24 itens". */
  countLabel: string
  /** O filtro em palavras (`storyFilterChips`). */
  chips: string[]
  ratingEnabled: boolean
  plan: StoryPlan
  size: GridSize
  /** id do item → a foto (sem ela, a inicial). */
  photos: Record<string, StoryPhoto | null>
  qr: string
  site: string
}) {
  return (
    <div
      style={{
        ...COLUMN,
        width: 1080,
        height: 1920,
        padding: "72px 72px 64px",
        backgroundColor: COLORS.bg,
        backgroundImage: "linear-gradient(180deg, #2a2030 0%, #131315 38%)",
        color: COLORS.ink,
      }}
    >
      <div style={{ ...ROW, gap: 20, height: AVATAR }}>
        {avatar ? (
          <img
            src={avatar}
            width={AVATAR}
            height={AVATAR}
            alt=""
            style={{ borderRadius: AVATAR / 2, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              ...ROW,
              justifyContent: "center",
              width: AVATAR,
              height: AVATAR,
              borderRadius: AVATAR / 2,
              backgroundColor: PHOTO_BG,
              color: COLORS.brand,
              fontSize: 36,
            }}
          >
            {(username[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div style={{ display: "flex", flex: 1, fontSize: 34, color: COLORS.muted, ...ELLIPSIS }}>
          @{username}
        </div>
        <div style={{ ...ROW, gap: 12, fontSize: 34, color: COLORS.brand }}>
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

      <div style={{ ...ROW, gap: 24, marginTop: 40 }}>
        {icon ? <div style={{ display: "flex", fontSize: 80, lineHeight: 1 }}>{icon}</div> : null}
        <div style={{ display: "flex", flex: 1, fontSize: 84, lineHeight: 1.15, ...ELLIPSIS }}>
          {name}
        </div>
      </div>
      {folderName ? (
        <div
          style={{ display: "flex", fontSize: 32, color: COLORS.muted, marginTop: 8, ...ELLIPSIS }}
        >
          em {folderName}
        </div>
      ) : null}

      <div style={{ ...ROW, gap: 14, marginTop: 20, height: 48, overflow: "hidden" }}>
        <div style={{ display: "flex", fontSize: 30, color: COLORS.muted, flexShrink: 0 }}>
          {countLabel}
        </div>
        {chips.map((chip) => (
          <div
            key={chip}
            style={{
              display: "flex",
              flexShrink: 0,
              padding: "4px 18px",
              borderRadius: 24,
              border: `2px solid ${COLORS.line}`,
              fontSize: 26,
              color: COLORS.muted,
            }}
          >
            {chip}
          </div>
        ))}
      </div>

      <div
        style={{
          ...COLUMN,
          width: STORY_BODY.width,
          height: STORY_BODY.height,
          marginTop: 40,
          overflow: "hidden",
        }}
      >
        {plan.mode === "grid" ? (
          <GridBody
            shown={plan.shown}
            more={plan.more}
            size={size}
            photos={photos}
            ratingEnabled={ratingEnabled}
          />
        ) : plan.mode === "list" ? (
          <ListBody
            shown={plan.shown}
            more={plan.more}
            photos={photos}
            ratingEnabled={ratingEnabled}
          />
        ) : (
          <TierBody rows={plan.rows} size={size} photos={photos} />
        )}
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <div
        style={{
          ...ROW,
          gap: 36,
          paddingTop: 36,
          borderTop: `2px solid ${COLORS.line}`,
        }}
      >
        <div
          style={{
            display: "flex",
            padding: 14,
            borderRadius: 24,
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        >
          <img src={qr} width={QR - 28} height={QR - 28} alt="" />
        </div>
        <div style={{ ...COLUMN, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", fontSize: 44, lineHeight: 1.2, color: COLORS.ink }}>
            Veja a lista inteira no Vitrine
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: COLORS.brand,
              marginTop: 12,
              ...ELLIPSIS,
            }}
          >
            {site}
          </div>
        </div>
      </div>
    </div>
  )
}

/** A foto quadrada de um item, com o enquadramento dele; sem foto, a inicial. */
function Photo({
  view,
  photo,
  side,
  radius,
}: {
  view: EntryView
  photo: StoryPhoto | null | undefined
  side: number
  radius: number
}) {
  const box = photo
    ? framedBox(
        photo.size,
        { width: side, height: side },
        { x: view.imageX, y: view.imageY, zoom: view.imageZoom }
      )
    : null
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: side,
        height: side,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: radius,
        backgroundColor: PHOTO_BG,
      }}
    >
      {photo && box ? (
        <img
          src={photo.src}
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
            width: side,
            height: side,
            fontSize: Math.round(side * 0.4),
            color: COLORS.brand,
          }}
        >
          {view.initial}
        </div>
      )}
    </div>
  )
}

/** O "+N" no lugar de um item: o que não coube na imagem. */
function More({
  count,
  width,
  height,
  radius,
  fontSize,
}: {
  count: number
  width: number
  height: number
  radius: number
  fontSize: number
}) {
  return (
    <div
      style={{
        ...COLUMN,
        alignItems: "center",
        justifyContent: "center",
        width,
        height,
        flexShrink: 0,
        borderRadius: radius,
        border: `3px solid ${COLORS.line}`,
        color: COLORS.muted,
        fontSize,
      }}
    >
      +{count}
      <div style={{ display: "flex", fontSize: Math.round(fontSize * 0.6), marginTop: 4 }}>
        na lista
      </div>
    </div>
  )
}

function GridBody({
  shown,
  more,
  size,
  photos,
  ratingEnabled,
}: {
  shown: EntryView[]
  more: number
  size: GridSize
  photos: Record<string, StoryPhoto | null>
  ratingEnabled: boolean
}) {
  const { cols, gap, name } = STORY_GRID[size]
  const cell = storyGridCell(size)
  const radius = Math.round(cell * 0.08)
  const nameSize = Math.round(name * 0.62)
  const badge = Math.round(name * 0.55)
  // A grade em linhas: o gerador não tem `grid`, só flex.
  const slots: (EntryView | "more")[] = more > 0 ? [...shown, "more"] : shown
  const rows: (EntryView | "more")[][] = []
  for (let index = 0; index < slots.length; index += cols)
    rows.push(slots.slice(index, index + cols))

  return (
    <div style={{ ...COLUMN, gap }}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ ...ROW, alignItems: "flex-start", gap }}>
          {row.map((slot) =>
            slot === "more" ? (
              <More
                key="more"
                count={more}
                width={cell}
                height={cell}
                radius={radius}
                fontSize={Math.round(cell * 0.2)}
              />
            ) : (
              <div key={slot.id} style={{ ...COLUMN, width: cell }}>
                <div style={{ display: "flex", position: "relative" }}>
                  <Photo view={slot} photo={photos[slot.id]} side={cell} radius={radius} />
                  {ratingEnabled && slot.rating !== null ? (
                    <div
                      style={{
                        ...ROW,
                        gap: 6,
                        position: "absolute",
                        left: 12,
                        bottom: 12,
                        padding: "2px 12px",
                        borderRadius: 12,
                        backgroundColor: "rgba(19, 19, 21, 0.85)",
                        fontSize: badge,
                        color: COLORS.ink,
                      }}
                    >
                      <Star size={badge} />
                      {formatRating(slot.rating)}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    height: name,
                    alignItems: "center",
                    fontSize: nameSize,
                    color: COLORS.ink,
                    ...ELLIPSIS,
                  }}
                >
                  {slot.name}
                </div>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  )
}

function ListBody({
  shown,
  more,
  photos,
  ratingEnabled,
}: {
  shown: EntryView[]
  more: number
  photos: Record<string, StoryPhoto | null>
  ratingEnabled: boolean
}) {
  const { height, gap, thumb } = STORY_LIST
  const row = {
    ...ROW,
    gap: 24,
    height,
    padding: "0 24px 0 12px",
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    border: `2px solid ${COLORS.line}`,
  } as const

  return (
    <div style={{ ...COLUMN, gap }}>
      {shown.map((view) => (
        <div key={view.id} style={row}>
          <Photo view={view} photo={photos[view.id]} side={thumb} radius={16} />
          <div style={{ ...COLUMN, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: 36, color: COLORS.ink, ...ELLIPSIS }}>
              {view.name}
            </div>
            {view.summary ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: COLORS.muted,
                  marginTop: 4,
                  ...ELLIPSIS,
                }}
              >
                {view.summary}
              </div>
            ) : null}
          </div>
          {ratingEnabled && view.rating !== null ? (
            <div style={{ ...ROW, gap: 8, fontSize: 34, color: COLORS.ink, flexShrink: 0 }}>
              <Star size={30} />
              {formatRating(view.rating)}
            </div>
          ) : null}
        </div>
      ))}
      {more > 0 ? (
        <div style={{ ...row, justifyContent: "center", fontSize: 32, color: COLORS.muted }}>
          +{itemCount(more)} na lista
        </div>
      ) : null}
    </div>
  )
}

function TierBody({
  rows,
  size,
  photos,
}: {
  rows: Extract<StoryPlan, { mode: "tier" }>["rows"]
  size: GridSize
  photos: Record<string, StoryPhoto | null>
}) {
  const { label, gap, pad, thumbGap } = STORY_TIER
  const thumb = storyTierThumb(size, rows.length)
  const radius = Math.round(thumb * 0.1)

  return (
    <div style={{ ...COLUMN, gap }}>
      {rows.map((row) => (
        <div key={row.tier?.id ?? "sem-nota"} style={{ ...ROW, alignItems: "stretch", gap }}>
          <div
            style={{
              ...ROW,
              justifyContent: "center",
              width: label,
              flexShrink: 0,
              borderRadius: 18,
              backgroundColor: row.tier?.color ?? COLORS.surface,
              color: row.tier ? TIER_INK : COLORS.muted,
              fontSize: row.tier ? 60 : 24,
              textAlign: "center",
            }}
          >
            {row.tier?.id ?? UNRATED_LABEL}
          </div>
          <div
            style={{
              ...ROW,
              flex: 1,
              gap: thumbGap,
              padding: pad,
              borderRadius: 18,
              backgroundColor: COLORS.surface,
            }}
          >
            {row.shown.map((view) => (
              <Photo
                key={view.id}
                view={view}
                photo={photos[view.id]}
                side={thumb}
                radius={radius}
              />
            ))}
            {row.more > 0 ? (
              <div
                style={{
                  ...ROW,
                  justifyContent: "center",
                  width: thumb,
                  height: thumb,
                  flexShrink: 0,
                  borderRadius: radius,
                  border: `3px solid ${COLORS.line}`,
                  color: COLORS.muted,
                  fontSize: Math.round(thumb * 0.3),
                }}
              >
                +{row.more}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
