import Link from "next/link"
import type { ReactNode } from "react"
import {
  AtSign,
  CirclePlay,
  MessageCircle,
  Music,
  Pencil,
  Settings,
  Star,
  type LucideIcon,
} from "lucide-react"

import { CoverImage } from "@/components/collection/collection-card"
import { CopyHandleChip } from "@/components/social/copy-handle-chip"
import { ProfileBanner } from "@/components/social/profile-banner"
import { RichText } from "@/components/social/rich-text"
import { ShareProfileButton } from "@/components/social/share-profile-button"
import { Avatar } from "@/components/ui/avatar-image"
import { buttonVariants } from "@/components/ui/button"
import {
  CARD_MAX_CATEGORIES,
  cardHasContent,
  SOCIAL_LABELS,
  type CardCategory,
  type ProfileCard,
  type SocialLink,
  type SocialProvider,
} from "@/lib/domain/card"
import { formatRating, itemCount } from "@/lib/domain/format"

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
 * bio, links das redes, a faixa social e até 6 categorias públicas com os 3
 * melhores itens. Todo mundo vê, com ou sem login.
 *
 * `ready = false`: a migração 23 ainda não rodou — o cartão mostra só o
 * nome e o @, e o dono não ganha o botão do story.
 *
 * No seu perfil: Editar perfil (nas Configurações), Compartilhar (link,
 * story e QR) e as Configurações. Embaixo, as abas
 * Coleções, Favoritas e Mapa (`ProfileTabs`).
 */
export function ProfileCardView({
  card,
  isMe,
  ready,
  social,
}: {
  card: ProfileCard
  isMe: boolean
  ready: boolean
  /** A faixa social (seguir, contagens) ou o convite para entrar. */
  social?: ReactNode
}) {
  const { banner, profile, bio, links, categories } = card
  const name = profile.display_name || profile.username

  // As ações do seu perfil: no computador ao lado da foto; no celular, numa
  // fileira só delas, embaixo (como no Instagram).
  const actions = isMe ? (
    <>
      <Link
        href="/configuracoes?secao=perfil"
        className={buttonVariants({ variant: "secondary", size: "lg" })}
      >
        <Pencil className="size-4" />
        {cardHasContent(card) ? "Editar perfil" : "Montar perfil"}
      </Link>
      <ShareProfileButton username={profile.username} storyReady={ready} />
      <Link
        href="/configuracoes"
        aria-label="Configurações"
        title="Configurações"
        className={buttonVariants({ variant: "secondary", size: "icon-lg" })}
      >
        <Settings className="size-4" />
      </Link>
    </>
  ) : null

  return (
    <section aria-label={`Perfil de @${profile.username}`}>
      {/* O banner no topo e a foto por cima da borda dele, como no Twitter. */}
      <ProfileBanner banner={banner} className="rounded-2xl" />
      <div className="relative -mt-12 flex flex-wrap items-end justify-between gap-3 px-1 sm:px-4">
        <Avatar
          name={name}
          src={profile.avatar_url}
          size={96}
          className="relative border-4 border-bg"
        />
        {actions ? (
          <div className="hidden flex-wrap items-center gap-2 pb-1 md:flex">{actions}</div>
        ) : null}
      </div>

      <div className="mt-3 space-y-3 px-1 sm:px-4">
        <div className="min-w-0">
          <h1 className="display text-3xl leading-tight break-words">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
        </div>

        {bio ? (
          <p className="max-w-2xl text-[0.95rem] leading-relaxed break-words whitespace-pre-line text-foreground">
            <RichText text={bio} />
          </p>
        ) : null}

        {links.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Redes">
            {links.map((link) => (
              <li key={link.provider} className="max-w-full">
                <SocialChip link={link} />
              </li>
            ))}
          </ul>
        ) : null}

        {social}

        {actions ? (
          <div className="flex flex-wrap gap-2 md:hidden [&>*:not([aria-label])]:flex-1">
            {actions}
          </div>
        ) : null}

        {isMe && !cardHasContent(card) ? (
          <p className="text-xs text-faint">
            Uma bio, seus links e até {CARD_MAX_CATEGORIES} categorias públicas em destaque.
          </p>
        ) : null}
      </div>

      {categories.length > 0 ? (
        <div className="mt-7">
          <p className="plaque mb-3 px-1 sm:px-4">Destaques</p>
          <ul className="flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] sm:px-4">
            {categories.map((category) => (
              <li key={category.id} className="w-56 shrink-0">
                <CardCategoryBox category={category} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
  const photos = category.top
    .flatMap((item) => (item.image_url ? [item.image_url] : []))
    .slice(0, 3)
  return (
    <Link
      href={`/categoria/${category.id}`}
      className="flex h-full flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-line-hi"
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
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {category.name}
        </span>
        <span className="shrink-0 text-xs text-faint">{itemCount(category.total)}</span>
      </div>

      {photos.length > 0 ? (
        <div className="flex -space-x-2">
          {photos.map((url, index) => (
            <span
              key={`${index}-${url}`}
              className="block size-12 overflow-hidden rounded-lg bg-surface-hi ring-2 ring-surface"
            >
              <CoverImage url={url} />
            </span>
          ))}
        </div>
      ) : category.top.length > 0 ? (
        <ol className="space-y-1">
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
        <p className="text-sm text-faint">Ainda sem itens.</p>
      )}
    </Link>
  )
}
