"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Camera,
  Check,
  GripVertical,
  ImageIcon,
  Italic,
  LayoutGrid,
  Link2,
  Move,
  Plus,
  Share2,
  Strikethrough,
  TextQuote,
  Underline,
  User,
  X,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import {
  updateBannerAction,
  updateIdentityAction,
  updateProfileCardAction,
  updateSocialLinksAction,
} from "@/app/configuracoes/actions"
import { SOCIAL_ICONS } from "@/components/social/profile-card"
import { ProfileBanner } from "@/components/social/profile-banner"
import { RichText } from "@/components/social/rich-text"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ActionResult } from "@/lib/actions/result"
import {
  BIO_MAX,
  CARD_MAX_CATEGORIES,
  CARD_NOT_READY,
  moveCardId,
  normalizeBannerUrl,
  normalizeSocialLink,
  SOCIAL_LABELS,
  SOCIAL_PLACEHOLDERS,
  SOCIAL_PROVIDERS,
  socialLinksFrom,
  type SocialProvider,
} from "@/lib/domain/card"
import { itemCount } from "@/lib/domain/format"
import {
  bannerPositionAfterDrag,
  changedProfileParts,
  PROFILE_PART_LABELS,
  type ProfileDraft,
} from "@/lib/domain/profile-edit"
import { cn } from "@/lib/utils"

export interface CardCategoryOption {
  id: string
  name: string
  icon: string | null
  total: number
}

/** Os botões da bio: cada um põe as marcas do formato em volta do que está selecionado. */
const FORMATS: { label: string; icon: LucideIcon; open: string; close: string }[] = [
  { label: "Negrito", icon: Bold, open: "**", close: "**" },
  { label: "Itálico", icon: Italic, open: "*", close: "*" },
  { label: "Sublinhado", icon: Underline, open: "__", close: "__" },
  { label: "Riscado", icon: Strikethrough, open: "~~", close: "~~" },
  { label: "Link", icon: Link2, open: "[", close: "](https://)" },
]

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
const PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-bg/85 px-2.5 py-1 text-xs text-foreground backdrop-blur"

/**
 * Editar perfil numa tela só, com um Salvar só. O cartão do topo é a prévia
 * ao vivo e é nele que se trocam o banner (a posição se arrasta) e a foto;
 * embaixo, Nome, Bio, Destaques e Redes. O Salvar grava só as partes que
 * mudaram (cada uma pela ação de sempre) e sair com algo mudado pergunta antes.
 */
export function ProfileEditor({
  username,
  initial,
  cardReady,
  options,
  names,
  profileHref,
}: {
  username: string
  /** O que está gravado agora. */
  initial: ProfileDraft
  /** A migração 23 já rodou? */
  cardReady: boolean
  /** As categorias que podem ir para o cartão (públicas de fato). */
  options: CardCategoryOption[]
  /** Todas as categorias da pessoa — para nomear uma escolhida que deixou de ser pública. */
  names: Record<string, string>
  /** Para o "Ver perfil" depois de salvar. */
  profileHref: string
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [panel, setPanel] = useState<"banner" | "avatar" | null>(null)
  const [linkErrors, setLinkErrors] = useState<Partial<Record<SocialProvider, string>>>({})
  const [pending, setPending] = useState(false)
  /** O endereço para onde a pessoa tentou ir com algo sem salvar. */
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const leaving = useRef(false)
  const bioRef = useRef<HTMLTextAreaElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const dragY = useRef<number | null>(null)

  const parts = changedProfileParts(saved, draft)
  const dirty = parts.length > 0
  const name = draft.displayName.trim() || username
  const banner = normalizeBannerUrl(draft.bannerUrl)
  const bannerPreview =
    banner.ok && banner.value ? { url: banner.value, position: draft.bannerPosition } : null
  const byId = new Map(options.map((option) => [option.id, option]))
  const ids = draft.categoryIds
  const available = options.filter((option) => !ids.includes(option.id))
  const full = ids.length >= CARD_MAX_CATEGORIES
  // A prévia das redes: só o que já fecha (o resto aparece como erro no campo).
  const previewLinks = socialLinksFrom(
    Object.fromEntries(
      SOCIAL_PROVIDERS.map((provider) => {
        const result = normalizeSocialLink(provider, draft.links[provider])
        return [provider, result.ok && result.value ? result.value : ""]
      })
    )
  )

  function update(patch: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  // Sair com algo sem salvar pergunta antes: fechar a aba (o navegador
  // pergunta) e qualquer link do app (o nosso diálogo).
  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    function onClick(event: MouseEvent) {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      // Na captura: chega antes do <Link> do Next, que navegaria.
      event.preventDefault()
      event.stopPropagation()
      setLeaveTo(url.pathname + url.search + url.hash)
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  /** Quanto a imagem do banner sobra na altura (com `cover`): o curso do arrasto. */
  function bannerOverflow(): number {
    const box = bannerRef.current
    const img = box?.querySelector("img")
    if (!box || !img || !img.naturalWidth) return 0
    const rect = box.getBoundingClientRect()
    return rect.width * (img.naturalHeight / img.naturalWidth) - rect.height
  }

  /**
   * Põe a marca em volta da seleção (sem seleção, em volta de "texto"). Os
   * espaços das pontas ficam de fora — com espaço por dentro, a marca não vale.
   */
  function applyFormat(format: (typeof FORMATS)[number]) {
    const area = bioRef.current
    if (!area) return
    const bio = draft.bio
    const start = area.selectionStart
    const end = area.selectionEnd
    const raw = bio.slice(start, end)
    const lead = raw.length - raw.trimStart().length
    const core = raw.trim() || "texto"
    const tail = raw.trim() ? raw.length - raw.trimEnd().length : 0
    const before = bio.slice(0, start) + raw.slice(0, lead)
    const inserted = format.open + core + format.close
    const next = before + inserted + raw.slice(raw.length - tail) + bio.slice(end)
    if (next.length > BIO_MAX) {
      toast.error(`Não cabe: a bio tem no máximo ${BIO_MAX} caracteres (as marcas contam).`)
      return
    }
    update({ bio: next })
    // Seleciona o texto (no link, o endereço, para digitar por cima).
    const selectFrom =
      format.label === "Link"
        ? before.length + format.open.length + core.length + 2
        : before.length + format.open.length
    const selectTo =
      format.label === "Link" ? before.length + inserted.length - 1 : selectFrom + core.length
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(selectFrom, selectTo)
    })
  }

  function checkLink(provider: SocialProvider): string | null {
    const result = normalizeSocialLink(provider, draft.links[provider])
    const error = result.ok ? null : result.error
    setLinkErrors((current) => ({ ...current, [provider]: error ?? undefined }))
    return error
  }

  function discard() {
    setDraft(saved)
    setLinkErrors({})
    setPanel(null)
  }

  async function save() {
    if (!banner.ok) {
      setPanel("banner")
      toast.error(banner.error)
      return
    }
    const badLink = SOCIAL_PROVIDERS.find((provider) => checkLink(provider))
    if (badLink) {
      toast.error(`Confira o ${SOCIAL_LABELS[badLink]} antes de salvar.`)
      document.getElementById(`social-${badLink}`)?.focus()
      return
    }

    setPending(true)
    let next = saved
    const failed: string[] = []
    let firstError: string | null = null
    async function step(
      label: string,
      run: () => Promise<ActionResult>,
      apply: (state: ProfileDraft) => ProfileDraft
    ) {
      const result = await run()
      if (result.ok) {
        next = apply(next)
      } else {
        failed.push(label)
        firstError ??= result.error
      }
    }
    // Cada parte pela ação de sempre (e só as que mudaram), uma depois da outra.
    if (parts.includes("banner")) {
      const position = Math.round(draft.bannerPosition)
      await step(
        "Banner",
        () => updateBannerAction({ url: draft.bannerUrl, position }),
        (state) => ({ ...state, bannerUrl: draft.bannerUrl, bannerPosition: draft.bannerPosition })
      )
    }
    if (parts.includes("identity")) {
      await step(
        "Foto e nome",
        () =>
          updateIdentityAction({
            displayName: draft.displayName,
            avatarUrl: draft.avatarUrl.trim() || null,
          }),
        (state) => ({ ...state, displayName: draft.displayName, avatarUrl: draft.avatarUrl })
      )
    }
    if (parts.includes("bio") || parts.includes("highlights")) {
      await step(
        "Bio e destaques",
        () => updateProfileCardAction({ bio: draft.bio, categoryIds: draft.categoryIds }),
        (state) => ({ ...state, bio: draft.bio, categoryIds: draft.categoryIds })
      )
    }
    if (parts.includes("social")) {
      await step(
        "Redes",
        () => updateSocialLinksAction({ links: draft.links }),
        (state) => ({ ...state, links: draft.links })
      )
    }
    setSaved(next)
    setPending(false)

    if (failed.length > 0) {
      const rest =
        changedProfileParts(next, draft).length < parts.length ? " O resto foi salvo." : ""
      toast.error(`Não deu para salvar ${failed.join(", ")}: ${firstError}${rest}`)
      return
    }
    setPanel(null)
    toast.success("Perfil salvo.", {
      action: { label: "Ver perfil", onClick: () => router.push(profileHref) },
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    update({ categoryIds: arrayMove(ids, from, to) })
  }

  const dirtyLabels = parts.map((part) => PROFILE_PART_LABELS[part])

  return (
    <section aria-label="Editar perfil" className="space-y-4">
      {/* ------------------------------------------------ o cartão (a prévia) */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div
          ref={bannerRef}
          role={bannerPreview ? "slider" : undefined}
          tabIndex={bannerPreview ? 0 : undefined}
          aria-label={bannerPreview ? "Posição do banner: arraste ou use as setas" : undefined}
          aria-valuemin={bannerPreview ? 0 : undefined}
          aria-valuemax={bannerPreview ? 100 : undefined}
          aria-valuenow={bannerPreview ? Math.round(draft.bannerPosition) : undefined}
          aria-valuetext={
            bannerPreview
              ? `${Math.round(draft.bannerPosition)}% (0 = topo da imagem, 100 = pé)`
              : undefined
          }
          onPointerDown={(event) => {
            if (!bannerPreview || (event.target as Element).closest("button")) return
            event.currentTarget.setPointerCapture(event.pointerId)
            dragY.current = event.clientY
          }}
          onPointerMove={(event) => {
            if (dragY.current === null) return
            const dy = event.clientY - dragY.current
            dragY.current = event.clientY
            const overflow = bannerOverflow()
            setDraft((current) => ({
              ...current,
              bannerPosition: bannerPositionAfterDrag(current.bannerPosition, dy, overflow),
            }))
          }}
          onPointerUp={() => {
            dragY.current = null
            setDraft((current) => ({
              ...current,
              bannerPosition: Math.round(current.bannerPosition),
            }))
          }}
          onPointerCancel={() => (dragY.current = null)}
          onKeyDown={(event) => {
            if (!bannerPreview || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
            event.preventDefault()
            const delta = event.key === "ArrowUp" ? -5 : 5
            update({ bannerPosition: Math.min(100, Math.max(0, draft.bannerPosition + delta)) })
          }}
          className={cn(
            "relative select-none",
            bannerPreview && "cursor-grab touch-none active:cursor-grabbing"
          )}
        >
          <ProfileBanner banner={bannerPreview} />
          {bannerPreview ? (
            <span className={cn(PILL, "pointer-events-none absolute top-2.5 left-2.5")}>
              <Move aria-hidden className="size-3" /> Arraste para ajustar
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setPanel((current) => (current === "banner" ? null : "banner"))}
            aria-expanded={panel === "banner"}
            className={cn(PILL, "absolute right-2.5 bottom-2.5 hover:bg-surface-hi")}
          >
            <ImageIcon aria-hidden className="size-3.5" />
            {bannerPreview ? "Trocar" : "Pôr banner"}
          </button>
        </div>

        {panel === "banner" ? (
          <EditPanel
            label="Link do banner"
            inputId="banner-url"
            value={draft.bannerUrl}
            onChange={(value) => update({ bannerUrl: value, bannerPosition: 50 })}
            invalid={!banner.ok}
            hint={
              banner.ok ? (
                "Larga fica melhor (1500×500). Nada é enviado nem copiado."
              ) : (
                <span className="text-danger">{banner.error}</span>
              )
            }
            removeLabel="Tirar o banner"
            onRemove={() => update({ bannerUrl: "" })}
            onDone={() => setPanel(null)}
          />
        ) : null}

        <div className="px-4 pb-4">
          <div className="relative -mt-10 w-fit">
            <Avatar
              name={name}
              src={draft.avatarUrl.trim() || null}
              size={84}
              className="border-4 border-surface"
            />
            <button
              type="button"
              onClick={() => setPanel((current) => (current === "avatar" ? null : "avatar"))}
              aria-expanded={panel === "avatar"}
              aria-label="Trocar a foto"
              title="Trocar a foto"
              className="absolute -right-0.5 bottom-0.5 flex size-8 items-center justify-center rounded-full border-[3px] border-surface bg-surface-hi text-foreground transition-colors hover:bg-line-hi"
            >
              <Camera aria-hidden className="size-3.5" />
            </button>
          </div>

          <p className="display mt-2 text-[1.65rem] leading-tight [overflow-wrap:anywhere]">
            {name}
          </p>
          <p className="truncate text-sm text-muted-foreground">@{username}</p>

          {draft.bio.trim() ? (
            <p className="mt-2.5 text-[0.95rem] leading-relaxed break-words whitespace-pre-line">
              <RichText text={draft.bio} />
            </p>
          ) : null}

          {previewLinks.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Redes (prévia)">
              {previewLinks.map((link) => {
                const Icon = SOCIAL_ICONS[link.provider]
                return (
                  <li
                    key={link.provider}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-hi px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    <Icon aria-hidden className="size-3 shrink-0" />
                    <span className="text-foreground">{SOCIAL_LABELS[link.provider]}</span>
                    <span className="truncate">{link.label}</span>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {ids.some((id) => byId.has(id)) ? (
            <ul
              className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
              aria-label="Destaques (prévia)"
            >
              {ids.flatMap((id) => {
                const option = byId.get(id)
                if (!option) return []
                return [
                  <li
                    key={id}
                    className="flex min-w-0 items-start gap-2 rounded-xl border border-line bg-bg-soft p-2.5"
                  >
                    <span aria-hidden className="text-lg leading-tight">
                      {option.icon || "📁"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{option.name}</span>
                      <span className="block text-xs text-faint">{itemCount(option.total)}</span>
                    </span>
                  </li>,
                ]
              })}
            </ul>
          ) : null}
        </div>

        {panel === "avatar" ? (
          <div className="pb-4">
            <EditPanel
              label="Link da foto"
              inputId="avatar-url"
              value={draft.avatarUrl}
              onChange={(value) => update({ avatarUrl: value })}
              hint="Quadrada fica melhor. Nada é enviado nem copiado."
              removeLabel="Tirar a foto"
              onRemove={() => update({ avatarUrl: "" })}
              onDone={() => setPanel(null)}
            />
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------ nome */}
      <Section icon={User} title="Nome" dirty={parts.includes("identity")}>
        <label htmlFor="display-name" className="mb-1.5 block text-xs text-muted-foreground">
          Nome de exibição
        </label>
        <Input
          id="display-name"
          value={draft.displayName}
          onChange={(event) => update({ displayName: event.target.value })}
          maxLength={80}
          placeholder="Como você quer aparecer"
          autoComplete="off"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-faint">
          <span className="truncate">@{username}</span>
          <Link
            href="/configuracoes?secao=usuario"
            className="shrink-0 text-brand underline-offset-2 hover:underline"
          >
            Trocar o @
          </Link>
        </div>
      </Section>

      {/* ------------------------------------------------ bio */}
      <Section icon={TextQuote} title="Bio" dirty={parts.includes("bio")}>
        {cardReady ? null : (
          <p className="mb-3 rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-sm text-muted-foreground">
            {CARD_NOT_READY}
          </p>
        )}
        <div role="toolbar" aria-label="Formatar a bio" className="mb-1.5 flex gap-0.5">
          {FORMATS.map((format) => (
            <button
              key={format.label}
              type="button"
              className={ICON_BUTTON}
              // Não tira o foco da caixa de texto (a seleção continua lá).
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyFormat(format)}
              aria-label={format.label}
              title={format.label}
            >
              <format.icon className="size-4" />
            </button>
          ))}
        </div>
        <label htmlFor="card-bio" className="sr-only">
          Bio
        </label>
        <Textarea
          ref={bioRef}
          id="card-bio"
          value={draft.bio}
          onChange={(event) => update({ bio: event.target.value.slice(0, BIO_MAX) })}
          maxLength={BIO_MAX}
          rows={3}
          placeholder="Do que você gosta, o que anda vendo, lendo, jogando…"
          aria-describedby="card-bio-help card-bio-count"
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p id="card-bio-help" className="text-xs leading-relaxed text-faint">
            Selecione um trecho e toque num botão. A prévia é o cartão lá em cima.
          </p>
          <p id="card-bio-count" className="shrink-0 text-xs text-faint tabular-nums">
            {draft.bio.length}/{BIO_MAX}
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------ destaques */}
      <Section
        icon={LayoutGrid}
        title="Destaques"
        dirty={parts.includes("highlights")}
        aside={
          <span className="text-xs text-faint tabular-nums">
            {ids.length} de {CARD_MAX_CATEGORIES}
          </span>
        }
      >
        {ids.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="mb-3 space-y-1.5">
                {ids.map((id, index) => (
                  <HighlightRow
                    key={id}
                    id={id}
                    index={index}
                    last={index === ids.length - 1}
                    option={byId.get(id) ?? null}
                    name={byId.get(id)?.name ?? names[id] ?? "Categoria"}
                    onMove={(delta) => update({ categoryIds: moveCardId(ids, index, delta) })}
                    onRemove={() => update({ categoryIds: ids.filter((item) => item !== id) })}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        ) : null}

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma categoria pública ainda. Deixe uma como Pública (no topo dela) para ela poder
            entrar no cartão.
          </p>
        ) : available.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">Pôr no cartão (só as públicas)</p>
            <div className="flex flex-wrap gap-1.5">
              {available.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={full}
                  onClick={() => update({ categoryIds: [...ids, option.id] })}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-line-hi px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <Plus aria-hidden className="size-3.5 shrink-0 text-brand" />
                  <span aria-hidden>{option.icon || "📁"}</span>
                  <span className="truncate">{option.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {full && available.length > 0 ? (
          <p className="mt-2 text-xs text-faint">O cartão está cheio: tire uma para pôr outra.</p>
        ) : (
          <p className="mt-2 text-xs text-faint">Cada uma mostra os 3 melhores itens.</p>
        )}
      </Section>

      {/* ------------------------------------------------ redes */}
      <Section icon={Share2} title="Redes" dirty={parts.includes("social")}>
        <div className="space-y-2">
          {SOCIAL_PROVIDERS.map((provider) => {
            const Icon = SOCIAL_ICONS[provider]
            const error = linkErrors[provider]
            return (
              <div
                key={provider}
                className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-start gap-2"
              >
                <label
                  htmlFor={`social-${provider}`}
                  className="flex h-9 items-center gap-2 text-sm text-muted-foreground"
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {SOCIAL_LABELS[provider]}
                </label>
                <div className="min-w-0 space-y-1">
                  <Input
                    id={`social-${provider}`}
                    value={draft.links[provider]}
                    onChange={(event) => {
                      update({ links: { ...draft.links, [provider]: event.target.value } })
                      setLinkErrors((current) => ({ ...current, [provider]: undefined }))
                    }}
                    onBlur={() => checkLink(provider)}
                    placeholder={SOCIAL_PLACEHOLDERS[provider]}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                  />
                  {error ? <p className="text-xs text-danger">{error}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ------------------------------------------------ o Salvar (um só) */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4">
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border bg-surface/95 py-2.5 pr-2.5 pl-4 shadow-2xl shadow-black/40 backdrop-blur",
            dirty ? "border-brand-dim" : "border-line-hi"
          )}
        >
          <p className="min-w-0 flex-1 text-sm text-muted-foreground" aria-live="polite">
            {dirty ? (
              <>
                <span className="font-medium text-foreground">
                  {parts.length === 1 ? "1 parte mudou" : `${parts.length} partes mudaram`}
                </span>
                <span className="hidden sm:inline"> · {dirtyLabels.join(", ")}</span>
              </>
            ) : (
              "Tudo salvo."
            )}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={discard}
            disabled={!dirty || pending}
          >
            Descartar
          </Button>
          <Button type="button" onClick={save} disabled={!dirty || pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={leaveTo !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTo(null)
        }}
        title="Sair sem salvar?"
        description={`O que você mudou aqui se perde (${dirtyLabels.join(", ")}).`}
        confirmLabel="Sair sem salvar"
        onConfirm={() => {
          if (!leaveTo) return
          leaving.current = true
          router.push(leaveTo)
        }}
      />
    </section>
  )
}

function Section({
  icon: Icon,
  title,
  dirty,
  aside,
  children,
}: {
  icon: LucideIcon
  title: string
  /** Mudou e falta salvar: o pontinho roxo. */
  dirty: boolean
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-wash text-brand">
          <Icon aria-hidden className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 text-[0.95rem] font-semibold">
          {title}
          {dirty ? <span className="sr-only"> (mudou, falta salvar)</span> : null}
        </h3>
        {aside}
        {dirty ? (
          <span aria-hidden title="Mudou, falta salvar" className="size-2 rounded-full bg-brand" />
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** O painel do link (banner ou foto), aberto pelo botão em cima da imagem. */
function EditPanel({
  label,
  inputId,
  value,
  onChange,
  invalid = false,
  hint,
  removeLabel,
  onRemove,
  onDone,
}: {
  label: string
  inputId: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  hint: ReactNode
  removeLabel: string
  onRemove: () => void
  onDone: () => void
}) {
  return (
    <div className="mx-4 mt-3 space-y-2.5 rounded-xl border border-brand-dim bg-bg-soft p-3">
      <label htmlFor={inputId} className="plaque block">
        {label}
      </label>
      <Input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://…"
        inputMode="url"
        autoComplete="off"
        autoFocus
        aria-invalid={invalid}
      />
      <p className="text-xs leading-relaxed text-faint">{hint}</p>
      <div className="flex items-center justify-between gap-2">
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            {removeLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          <Check className="size-4" /> Pronto
        </Button>
      </div>
    </div>
  )
}

/** Uma categoria do cartão: arrasta pela alça ou sobe/desce pelas setas. */
function HighlightRow({
  id,
  index,
  last,
  option,
  name,
  onMove,
  onRemove,
}: {
  id: string
  index: number
  last: boolean
  /** `null` = deixou de ser pública: fica na lista, mas não aparece no cartão. */
  option: CardCategoryOption | null
  name: string
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-line bg-bg-soft py-1 pr-1 pl-0.5",
        isDragging && "z-10 border-line-hi shadow-lg"
      )}
    >
      <button
        type="button"
        className={cn(ICON_BUTTON, "cursor-grab touch-none active:cursor-grabbing")}
        aria-label={`Reordenar ${name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-4 shrink-0 text-center text-xs text-faint tabular-nums">{index + 1}</span>
      <span aria-hidden>{option?.icon || "📁"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        {option ? null : (
          <span className="block text-xs text-danger">Não é pública agora: não aparece.</span>
        )}
      </span>
      <button
        type="button"
        className={ICON_BUTTON}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Subir ${name}`}
      >
        <ArrowUp className="size-4" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        disabled={last}
        onClick={() => onMove(1)}
        aria-label={`Descer ${name}`}
      >
        <ArrowDown className="size-4" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        onClick={onRemove}
        aria-label={`Tirar ${name} do cartão`}
      >
        <X className="size-4" />
      </button>
    </li>
  )
}
