import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { EntryDetailActions } from "@/components/entry/entry-detail-actions"
import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { OpenInMapsLink, VitrineMapLink } from "@/components/map/maps-links"
import { TagPill } from "@/components/tag/tag-pill"
import { formatRating } from "@/lib/domain/format"
import { mapsTargetOf } from "@/lib/domain/maps-links"
import type {
  Category,
  CategorySummary,
  EntryFolder,
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
}) {
  const placeOf = (fieldId: string) => places.find((place) => place.field_id === fieldId)
  const folder = entryFolders.find((item) => item.id === view.folderId) ?? null
  const backHref = withFolder(`/categoria/${category.id}`, folder?.id ?? null)
  const backLabel = folder
    ? `📁 ${folder.name}`
    : `${category.icon ? `${category.icon} ` : ""}${category.name}`
  const ownerName = owner?.display_name || owner?.username || "alguém"

  return (
    <div className="py-8">
      <Link
        href={backHref}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="grid gap-8 md:grid-cols-[2fr_3fr]">
        <div>
          <EntryImage
            imageUrl={view.imageUrl}
            imageTransform={view.imageTransform}
            initial={view.initial}
            initialSize="6rem"
            eager
            tint={category.color}
          />
        </div>

        <div className="min-w-0 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              {owner && !canEdit ? (
                <Link
                  href={profilePath(owner.username)}
                  className="plaque block hover:text-foreground"
                >
                  acervo de {ownerName}
                </Link>
              ) : null}

              <h1 className="display text-[2.3rem] leading-tight break-words">{view.name}</h1>

              {category.rating_enabled ? (
                <div className="flex items-center gap-2">
                  <Stars percent={view.ratingPercent} size="md" />
                  <span className="text-sm text-muted-foreground">
                    {view.hasRating ? `${formatRating(view.rating)} de 5` : "sem avaliação"}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Editar e excluir moram no "⋯". */}
            {canEdit ? (
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

          {view.sourceRemoved ? (
            <p className="text-sm text-muted-foreground">
              Removido do original: quem fez a categoria apagou este item. O seu continua aqui.
            </p>
          ) : null}

          {view.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {view.tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} />
              ))}
            </div>
          ) : null}

          {view.extras.length > 0 ? (
            <dl className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
              {view.extras.map((extra) => (
                <div
                  key={extra.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <dt className="shrink-0 text-sm text-muted-foreground">{extra.label}</dt>
                  <dd className="min-w-0 text-sm break-words sm:text-right">
                    {extra.isStar ? (
                      <span className="flex items-center gap-2 sm:justify-end">
                        <Stars percent={extra.percent} size="sm" />
                        <span>{extra.value}</span>
                      </span>
                    ) : extra.tipo === "location" ? (
                      <span className="flex flex-col items-start gap-2 sm:items-end">
                        <span>{extra.value}</span>
                        <span className="flex flex-wrap gap-1.5 sm:justify-end">
                          <OpenInMapsLink target={mapsTargetOf(extra.value, placeOf(extra.id))} />
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

        </div>
      </div>
    </div>
  )
}
