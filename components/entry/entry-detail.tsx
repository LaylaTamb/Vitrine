import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { EntryDetailActions } from "@/components/entry/entry-detail-actions"
import { EntryImage } from "@/components/entry/entry-image"
import { FavoriteDetailToggle } from "@/components/entry/favorite-star"
import { Stars } from "@/components/entry/stars"
import { OpenInMapsLink, VitrineMapLink } from "@/components/map/maps-links"
import { MatchEntryActions } from "@/components/match/match-entry-actions"
import { MatchOwnerLine } from "@/components/match/match-marks"
import { TagPill } from "@/components/tag/tag-pill"
import { formatRating } from "@/lib/domain/format"
import { mapsTargetOf } from "@/lib/domain/maps-links"
import { matchOwnerText, suggestionText, type MatchOrigin } from "@/lib/domain/match"
import type {
  Category,
  CategorySummary,
  EntryFolder,
  EntryMatch,
  EntryPlace,
  EntryView,
  Profile,
  Tag,
} from "@/lib/domain/types"
import { profilePath } from "@/lib/domain/username"
import { withFolder } from "@/lib/navigation"

/**
 * A plaqueta completa do item. Sem estado e sem hook (Server Component): a
 * página com login e a de quem não tem conta usam a mesma.
 *
 * O "voltar" sobe um nível: para a subpasta onde o item está, ou para a raiz
 * da categoria.
 *
 * Campo de Localização ganha "Abrir no Maps" — que funciona até sem
 * `places` (sem login, ou quando o endereço não foi encontrado): vai o
 * texto do endereço.
 */
export function EntryDetail({
  view,
  category,
  owner,
  tags,
  entryFolders,
  canEdit,
  places = [],
  showMapLink = false,
  categories = [],
  isFavorite = false,
  match = null,
}: {
  view: EntryView
  category: Category
  /** Sem dono: some o link "acervo de …". */
  owner: Profile | null
  tags: Tag[]
  entryFolders: EntryFolder[]
  canEdit: boolean
  /** As linhas de `entry_places` deste item (place_id e coordenadas para os links). */
  places?: EntryPlace[]
  /** "Ver no mapa do Vitrine": só para o dono. */
  showMapLink?: boolean
  /** As categorias do dono — o seletor "Categoria" da edição (trocar o item de categoria). */
  categories?: CategorySummary[]
  /** É o favorito da categoria — só vem para o dono. */
  isFavorite?: boolean
  /**
   * Item da cópia de um match (migração 31): de quem é, as marcações e os
   * campos do original, só leitura.
   */
  match?: { entry: EntryMatch; origin: MatchOrigin } | null
}) {
  const placeOf = (fieldId: string) => places.find((place) => place.field_id === fieldId)
  const folder = entryFolders.find((item) => item.id === view.folderId) ?? null
  const backHref = withFolder(`/categoria/${category.id}`, folder?.id ?? null)
  const backLabel = folder
    ? `📁 ${folder.name}`
    : `${category.icon ? `${category.icon} ` : ""}${category.name}`
  const ownerName = owner?.display_name || owner?.username || "alguém"

  return (
    <div className="grid gap-8 py-8 md:grid-cols-[2fr_3fr]">
      <div>
        <EntryImage
          imageUrl={view.imageUrl}
          imageTransform={view.imageTransform}
          initial={view.initial}
          initialSize="6rem"
          eager
          tint={match?.entry.color ?? category.color}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            voltar para {backLabel}
          </Link>

          {match ? (
            <MatchOwnerLine match={match.entry} className="text-xs" />
          ) : owner ? (
            <Link href={profilePath(owner.username)} className="plaque block hover:text-foreground">
              acervo de {ownerName}
            </Link>
          ) : null}
        </div>

        <h1 className="display text-[2.3rem] leading-tight break-words">{view.name}</h1>

        {view.sourceRemoved ? (
          <p className="text-sm text-muted-foreground">
            Removido do original: quem fez a categoria apagou este item. O seu continua aqui.
          </p>
        ) : null}

        {match && match.entry.suggestionFor.length > 0 ? (
          <p className="text-sm text-muted-foreground">{suggestionText(match.entry)}</p>
        ) : null}

        {canEdit && !match ? (
          <FavoriteDetailToggle
            categoryId={category.id}
            categoryName={category.name}
            entryId={view.id}
            entryName={view.name}
            isFavorite={isFavorite}
          />
        ) : null}

        {category.rating_enabled ? (
          <div className="flex items-center gap-2">
            <Stars percent={view.ratingPercent} size="md" />
            <span className="text-sm text-muted-foreground">
              {view.hasRating ? `${formatRating(view.rating)} de 5` : "sem avaliação"}
              {match && view.hasRating
                ? ` · nota ${match.entry.isMine ? "sua" : matchOwnerText(match.entry)}`
                : ""}
            </span>
          </div>
        ) : null}

        {view.extras.length > 0 ? (
          <dl className="pt-2">
            {view.extras.map((extra) => (
              <div
                key={extra.id}
                className="flex flex-col gap-0.5 border-b border-line py-2.5 sm:flex-row sm:gap-4"
              >
                <dt className="plaque w-40 shrink-0 pt-0.5">{extra.label}</dt>
                <dd className="min-w-0 flex-1 text-sm break-words">
                  {extra.isStar ? (
                    <span className="flex items-center gap-2">
                      <Stars percent={extra.percent} size="sm" />
                      <span>{extra.value}</span>
                    </span>
                  ) : extra.tipo === "location" ? (
                    <span className="flex flex-col items-start gap-2">
                      <span>{extra.value}</span>
                      <span className="flex flex-wrap gap-1.5">
                        <OpenInMapsLink
                          target={mapsTargetOf(extra.value, placeOf(extra.id))}
                        />
                        {showMapLink ? <VitrineMapLink entryId={view.id} /> : null}
                      </span>
                    </span>
                  ) : (
                    extra.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {match && (match.origin.category || match.origin.fields.length > 0) ? (
          <div className="pt-2">
            <p className="plaque">
              {match.origin.category ? `em “${match.origin.category}”` : "do original"} · só
              leitura
            </p>
            {match.origin.fields.length > 0 ? (
              <dl>
                {match.origin.fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-0.5 border-b border-line py-2.5 sm:flex-row sm:gap-4"
                  >
                    <dt className="plaque w-40 shrink-0 pt-0.5">{field.label}</dt>
                    <dd className="min-w-0 flex-1 text-sm break-words">
                      {field.tipo === "location" ? (
                        <span className="flex flex-col items-start gap-2">
                          <span>{field.value}</span>
                          <OpenInMapsLink target={mapsTargetOf(field.value, placeOf(field.id))} />
                        </span>
                      ) : (
                        field.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        {view.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {view.tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>
        ) : null}

        {canEdit && match ? (
          <MatchEntryActions
            view={view}
            categoryId={category.id}
            tags={tags}
            isMine={match.entry.isMine}
          />
        ) : canEdit ? (
          <EntryDetailActions
            view={view}
            categoryId={category.id}
            estrutura={category.estrutura}
            tags={tags}
            folders={entryFolders}
            ratingEnabled={category.rating_enabled}
            categories={categories}
          />
        ) : null}
      </div>
    </div>
  )
}
