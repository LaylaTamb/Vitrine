import Link from "next/link"
import type { ReactNode } from "react"
import {
  AtSign,
  CirclePlay,
  MessageCircle,
  Music,
  Pencil,
  Star,
  type LucideIcon,
} from "lucide-react"

import { CopyHandleChip } from "@/components/social/copy-handle-chip"
import { ProfileBanner } from "@/components/social/profile-banner"
import { ShareStoryButton } from "@/components/social/share-story-button"
import { Avatar } from "@/components/ui/avatar-image"
import { buttonVariants } from "@/components/ui/button"
import {
  cardHasContent,
  SOCIAL_LABELS,
  type CardCategory,
  type ProfileCard,
  type SocialLink,
  type SocialProvider,
} from "@/lib/domain/card"
import { formatRating, itemCount } from "@/lib/domain/format"
import { profilePath } from "@/lib/domain/username"

const SOCIAL_ICONS: Record<SocialProvider, LucideIcon> = {
  instagram: AtSign,
  x: AtSign,
  discord: MessageCircle,
  spotify: Music,
  youtube: CirclePlay,
}

const CHIP =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-hi px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"

/**
 * O cartão de apresentação no topo do perfil (migração 23): foto, nome, @,
 * bio, links das redes, a faixa social e até 5 categorias públicas com os 3
 * melhores itens. Todo mundo vê, com ou sem login.
 *
 * `ready = false`: a migração 23 ainda não rodou — o cartão mostra só o
 * nome e o @, e o dono não ganha o botão do story.
 *
 * O dono edita aqui mesmo: "Editar cartão" abre `?editar=1`, e o painel de
 * edição aparece logo abaixo (`ProfileEditPanel`).
 */
export function ProfileCardView({
  card,
  isMe,
  ready,
  social,
  editing = false,
}: {
  card: ProfileCard
  isMe: boolean
  ready: boolean
  /** O painel de edição está aberto embaixo: o botão Editar sai. */
  editing?: boolean
  /** A faixa social (seguir, contagens) ou o convite para entrar. */
  social?: ReactNode
}) {
  const { banner, profile, bio, links, categories } = card
  const name = profile.display_name || profile.username

  return (
    <section
      aria-label={`Cartão de @${profile.username}`}
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      {/* O banner no topo e a foto por cima da borda dele, como no Twitter. */}
      <ProfileBanner banner={banner} />
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <Avatar
          name={name}
          src={profile.avatar_url}
          size={88}
          className="relative -mt-11 border-4 border-surface"
        />
        <div className="mt-2 min-w-0">
          <h1 className="display text-2xl leading-tight break-words sm:text-3xl">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
        </div>

        {bio ? (
          <p className="mt-4 text-sm leading-relaxed break-words whitespace-pre-line text-foreground">
            {bio}
          </p>
        ) : null}

        {links.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Redes">
            {links.map((link) => (
              <li key={link.provider} className="max-w-full">
                <SocialChip link={link} />
              </li>
            ))}
          </ul>
        ) : null}

        {social ? <div className="mt-4">{social}</div> : null}

        {categories.length > 0 ? (
          <div className="mt-5">
            <p className="plaque mb-2">Destaques</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <li key={category.id} className="min-w-0">
                  <CardCategoryBox category={category} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isMe ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {ready ? <ShareStoryButton username={profile.username} /> : null}
            {editing ? null : (
              <Link
                href={`${profilePath(profile.username)}?editar=1#editar`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Pencil className="size-4" />
                {cardHasContent(card) ? "Editar cartão" : "Montar cartão"}
              </Link>
            )}
            {cardHasContent(card) || editing ? null : (
              <p className="w-full text-xs text-faint sm:w-auto">
                Uma bio, seus links e até 5 categorias públicas com os 3 melhores itens.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SocialChip({ link }: { link: SocialLink }) {
  const Icon = SOCIAL_ICONS[link.provider]
  const content = (
    <>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="text-foreground">{SOCIAL_LABELS[link.provider]}</span>
      <span className="truncate">{link.label}</span>
    </>
  )
  // Nome do Discord não tem página pública: o toque copia.
  if (!link.href) {
    return (
      <CopyHandleChip value={link.label} className={CHIP}>
        {content}
      </CopyHandleChip>
    )
  }
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className={CHIP}>
      {content}
    </a>
  )
}

function CardCategoryBox({ category }: { category: CardCategory }) {
  return (
    <Link
      href={`/categoria/${category.id}`}
      className="block h-full rounded-xl border border-line bg-background/40 p-3 transition-colors hover:border-brand-dim"
    >
      <div className="flex items-center gap-2">
        {category.color ? (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
        ) : null}
        <span aria-hidden>{category.icon || "📁"}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{category.name}</span>
        <span className="shrink-0 text-xs text-faint">{itemCount(category.total)}</span>
      </div>

      {category.top.length > 0 ? (
        <ol className="mt-2 space-y-1">
          {category.top.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-xs text-faint tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
              {category.rating_enabled && item.rating !== null ? (
                <span className="flex shrink-0 items-center gap-0.5 text-xs text-brand">
                  <Star aria-hidden className="size-3 fill-current" />
                  <span className="sr-only">Nota </span>
                  {formatRating(item.rating)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-faint">Ainda sem itens.</p>
      )}
    </Link>
  )
}
