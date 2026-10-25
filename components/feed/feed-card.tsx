import Link from "next/link"

import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { Avatar } from "@/components/ui/avatar-image"
import { feedAction, type FeedEntry, type FeedGroup } from "@/lib/domain/feed"
import { formatRating } from "@/lib/domain/format"
import { timeAgo } from "@/lib/domain/social"
import { profilePath } from "@/lib/domain/username"

/** Quantos itens o cartão mostra (o resto vira "+N"). */
const SHOWN = 3

/**
 * Um cartão do Início: quem, o que fez e onde — "Ana adicionou 5 itens em
 * ☕ Cafés" — com as fotos dos itens (até 3). Um item só ganha a foto grande
 * e a nota. `now`: a hora do servidor, para o "há 5 min" bater na hidratação.
 */
export function FeedCard({ group, now }: { group: FeedGroup; now: Date }) {
  const { owner, category, entries } = group
  const name = owner.display_name || owner.username
  const categoryHref = `/categoria/${category.id}`
  const itemHref = (entry: FeedEntry) => `${categoryHref}/${entry.id}`

  return (
    <article className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Link href={profilePath(owner.username)} className="shrink-0">
          <Avatar name={name} src={owner.avatar_url} size={40} />
        </Link>
        <p className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">
          <Link href={profilePath(owner.username)} className="font-medium hover:text-brand">
            {name}
          </Link>{" "}
          <span className="text-muted-foreground">
            {feedAction(entries.length)}{" "}
            <Link href={categoryHref} className="hover:text-foreground">
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </Link>
          </span>
          <span className="block text-xs text-faint">{timeAgo(group.latestAt, now)}</span>
        </p>
      </div>

      {entries.length === 1 ? (
        <Link href={itemHref(entries[0])} className="flex gap-4">
          <span className="w-24 shrink-0 overflow-hidden rounded-xl sm:w-28">
            <EntryImage
              imageUrl={entries[0].imageUrl}
              imageTransform={entries[0].imageTransform}
              initial={entries[0].name.charAt(0).toUpperCase()}
              ratio="4 / 5"
              initialSize="2.5rem"
            />
          </span>
          <span className="min-w-0 space-y-1.5 py-1">
            <span className="display block text-2xl leading-tight [overflow-wrap:anywhere]">
              {entries[0].name}
            </span>
            {category.ratingEnabled && entries[0].rating !== null ? (
              <span className="flex items-center gap-2">
                <Stars percent={(entries[0].rating / 5) * 100} />
                <span className="text-sm text-muted-foreground">
                  {formatRating(entries[0].rating)}
                </span>
              </span>
            ) : null}
          </span>
        </Link>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {entries.slice(0, SHOWN).map((entry, index) => {
            const more = index === SHOWN - 1 ? entries.length - SHOWN : 0
            return (
              <li key={entry.id} className="min-w-0 space-y-1.5">
                <Link href={itemHref(entry)} className="relative block overflow-hidden rounded-xl">
                  <EntryImage
                    imageUrl={entry.imageUrl}
                    imageTransform={entry.imageTransform}
                    initial={entry.name.charAt(0).toUpperCase()}
                    ratio="4 / 5"
                    initialSize="2rem"
                  />
                  {category.ratingEnabled && entry.rating !== null ? (
                    <span className="absolute bottom-1.5 left-1.5 z-10 inline-flex items-center gap-1 rounded-md bg-bg/85 px-1.5 py-0.5 text-xs backdrop-blur-sm">
                      <span aria-hidden className="text-brand">
                        ★
                      </span>
                      <span className="sr-only">Nota </span>
                      {formatRating(entry.rating)}
                    </span>
                  ) : null}
                  {more > 0 ? (
                    <span className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 text-lg font-medium">
                      +{more}
                    </span>
                  ) : null}
                </Link>
                <p className="display truncate text-sm">{entry.name}</p>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href={categoryHref}
        className="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        Ver categoria
      </Link>
    </article>
  )
}
