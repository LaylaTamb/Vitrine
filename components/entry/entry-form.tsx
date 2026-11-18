"use client"

import { Check, ChevronDown, Eraser, ImageIcon, Move, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { EntryImage } from "@/components/entry/entry-image"
import { FieldInput } from "@/components/entry/field-input"
import { ImageFramer } from "@/components/entry/image-framer"
import { StarInput } from "@/components/entry/stars"
import { geocodeAfterSave } from "@/components/map/geocode-runner"
import { useVitrine } from "@/components/providers/vitrine-context"
import { ColorPalette } from "@/components/tag/color-palette"
import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moveTargets } from "@/lib/domain/collections"
import { locationFieldsOf } from "@/lib/domain/fields"
import { formatRating } from "@/lib/domain/format"
import { moveSummary } from "@/lib/domain/migrate"
import { DEFAULT_TAG_COLOR } from "@/lib/domain/tags"
import type { CategorySummary, EntryFolder, EntryView, Estrutura, Tag } from "@/lib/domain/types"
import { imageStyleOf } from "@/lib/domain/view"
import { cn } from "@/lib/utils"

const DEFAULT_FRAMING = { x: 50, y: 50, zoom: 1 }
/** A roda e a pinça calculam com muitas casas; para gravar, duas bastam. */
const round2 = (value: number) => Math.round(value * 100) / 100
const ROOT = "__raiz__"
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"

/**
 * Criar ou editar um item. No topo, o essencial: a imagem (um quadrado que
 * abre o link e o enquadramento), o nome, a nota e "onde fica" (categoria e
 * subpasta, numa etiqueta). Embaixo, os campos da categoria e as tags.
 */
export function EntryForm({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  categoryIcon,
  estrutura,
  tags,
  entry,
  folders,
  defaultFolderId = null,
  ratingEnabled = true,
  categories = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  /** Para a etiqueta "onde fica". Sem ele, vem da lista `categories`. */
  categoryName?: string
  categoryIcon?: string | null
  estrutura: Estrutura
  tags: Tag[]
  /** Sem `entry` = novo item. */
  entry?: EntryView | null
  /** Subpastas da categoria. Sem a lista, o formulário não mexe na pasta do item. */
  folders?: EntryFolder[]
  /** Onde um item NOVO nasce: a pasta que está aberta. */
  defaultFolderId?: string | null
  /** Categoria sem estrelas (lista simples): o campo de avaliação some. */
  ratingEnabled?: boolean
  /**
   * As categorias da pessoa. Com a lista, a edição ganha o seletor
   * "Categoria": trocar move o item (e reabre a edição na categoria nova).
   */
  categories?: CategorySummary[]
}) {
  const { actions } = useVitrine()
  const router = useRouter()
  const editing = Boolean(entry)
  /** O destino escolhido no seletor "Categoria", esperando a confirmação. */
  const [moveTo, setMoveTo] = useState<CategorySummary | null>(null)

  const [name, setName] = useState("")
  const [rating, setRating] = useState(0)
  const [imageUrl, setImageUrl] = useState("")
  const [framing, setFraming] = useState(DEFAULT_FRAMING)
  const [values, setValues] = useState<Record<string, string>>({})
  const [tagIds, setTagIds] = useState<string[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [extraTags, setExtraTags] = useState<Tag[]>([])
  const [pending, setPending] = useState(false)
  /** O painel do link e do enquadramento, aberto pelo quadrado da imagem. */
  const [imageOpen, setImageOpen] = useState(false)
  /** Os seletores de categoria e subpasta, abertos pela etiqueta "onde fica". */
  const [placeOpen, setPlaceOpen] = useState(false)

  const [creatingTag, setCreatingTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR)

  const folderOptions = useMemo(
    () => (folders && folders.length > 0 ? moveTargets(folders, null, "Raiz da categoria") : []),
    [folders]
  )

  const allTags = useMemo(() => {
    const seen = new Map(tags.map((tag) => [tag.id, tag]))
    for (const tag of extraTags) seen.set(tag.id, tag)
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [tags, extraTags])

  useEffect(() => {
    if (!open) return
    setName(entry?.name ?? "")
    setRating(entry?.rating ?? 0)
    setImageUrl(entry?.imageUrl ?? "")
    setFraming(
      entry ? { x: entry.imageX, y: entry.imageY, zoom: entry.imageZoom } : DEFAULT_FRAMING
    )
    setValues(
      entry
        ? Object.fromEntries(
            Object.entries(entry.values).map(([key, value]) => [key, String(value)])
          )
        : {}
    )
    setTagIds(entry?.tags.map((tag) => tag.id) ?? [])
    setFolderId(entry ? entry.folderId : defaultFolderId)
    setImageOpen(false)
    setPlaceOpen(false)
    setCreatingTag(false)
    setNewTagName("")
    setNewTagColor(DEFAULT_TAG_COLOR)
  }, [open, entry, defaultFolderId])

  function setValue(fieldId: string, value: string) {
    setValues((current) => ({ ...current, [fieldId]: value }))
  }

  async function addTag() {
    if (!newTagName.trim()) return
    setPending(true)
    const result = await actions.createTag({ name: newTagName, color: newTagColor, categoryId })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const tag = result.data
    if (tag) {
      setExtraTags((current) => [...current, tag])
      setTagIds((current) => [...current, tag.id])
    }
    setNewTagName("")
    setCreatingTag(false)
  }

  /** O que está no formulário agora, pronto para gravar — `null` (com aviso) se faltar o nome. */
  function currentPayload() {
    if (!name.trim()) {
      toast.error("Dê um nome ao item.")
      return null
    }
    return {
      categoryId,
      name: name.trim(),
      rating: ratingEnabled && rating > 0 ? rating : null,
      imageUrl: imageUrl.trim() || null,
      imageDisplay: { x: round2(framing.x), y: round2(framing.y), zoom: round2(framing.zoom) },
      customFields: values,
      tagIds,
      ...(folders ? { folderId } : {}),
    }
  }

  /**
   * Trocar de categoria: salva o que foi mexido aqui, move (os valores vão
   * pelo mesmo campo ou pelo mesmo nome e tipo; tags, imagem e — se o
   * destino usa estrelas — a nota vão junto) e reabre a edição lá.
   */
  async function moveToCategory(target: CategorySummary) {
    if (!entry) return
    const payload = currentPayload()
    if (!payload) return

    setPending(true)
    const saved = await actions.updateEntry({ ...payload, id: entry.id })
    if (!saved.ok) {
      setPending(false)
      toast.error(saved.error)
      return
    }
    const moved = await actions.bulkMoveEntries({
      ids: [entry.id],
      categoryId,
      toCategoryId: target.id,
    })
    setPending(false)
    if (!moved.ok) {
      toast.error(moved.error)
      return
    }

    toast.success(`“${payload.name}” agora está em “${target.name}”. Complete o que faltar.`)
    onOpenChange(false)
    if (locationFieldsOf(target.estrutura).length > 0) {
      void geocodeAfterSave(actions, entry.id)
    }
    router.push(`/categoria/${target.id}?editar=${entry.id}`)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const payload = currentPayload()
    if (!payload) return

    setPending(true)
    const result = entry
      ? await actions.updateEntry({ ...payload, id: entry.id })
      : await actions.createEntry(payload)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(editing ? "Item salvo." : "Item adicionado.")
    onOpenChange(false)

    // O mapa nunca segura o salvamento: o item já está gravado, e o endereço
    // que mudou é procurado agora, em segundo plano.
    const savedId = entry ? entry.id : (result.data as { id?: string } | undefined)?.id
    const addressChanged = locationFieldsOf(estrutura).some(
      (field) => (values[field.id] ?? "").trim() !== String(entry?.values[field.id] ?? "").trim()
    )
    if (savedId && addressChanged) void geocodeAfterSave(actions, savedId)
  }

  const image = imageUrl.trim()
  const initial = (name.trim()[0] ?? "?").toUpperCase()
  const here = categories.find((item) => item.id === categoryId)
  const placeName = categoryName ?? here?.name ?? null
  const placeIcon = categoryIcon ?? here?.icon ?? null
  const folderLabel = folderId
    ? (folderOptions.find((option) => option.id === folderId)?.label ?? null)
    : null
  const canChangeCategory = editing && categories.length > 1
  const canChangeFolder = folderOptions.length > 1
  const filled = estrutura.filter((field) => (values[field.id] ?? "").trim()).length
  const placeLabel = (
    <>
      <span className="truncate">
        {placeIcon ? `${placeIcon} ` : ""}
        {placeName ?? "Esta categoria"}
        {folderLabel ? ` › ${folderLabel}` : ""}
      </span>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          // Esc fecha primeiro o que está aberto por cima: a tag nova, a imagem, o "onde fica".
          if (creatingTag || imageOpen || placeOpen) {
            event.preventDefault()
            setCreatingTag(false)
            setImageOpen(false)
            setPlaceOpen(false)
          }
        }}
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="px-5 pt-4 pr-12 pb-2">
            <DialogTitle className="display text-2xl leading-tight">
              {editing ? "Editar item" : "Novo item"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Nome, imagem e nota no topo; embaixo, os campos da categoria e as tags.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 space-y-7 overflow-y-auto px-5 pt-2 pb-6">
            <div className="space-y-3">
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
                {/* A imagem: o quadrado inteiro é o botão que abre o link e o enquadramento. */}
                <div className="group relative">
                  {image ? (
                    <EntryImage
                      imageUrl={image}
                      imageStyle={imageStyleOf(framing)}
                      initial={initial}
                      initialSize="2rem"
                      eager
                    />
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-hi text-faint transition-colors group-hover:border-brand-dim group-hover:text-foreground">
                      <ImageIcon aria-hidden className="size-5" />
                      <span className="text-xs">Imagem</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setImageOpen((current) => !current)}
                    aria-expanded={imageOpen}
                    aria-controls="entry-image-panel"
                    aria-label={image ? "Enquadrar ou trocar a imagem" : "Pôr uma imagem (link)"}
                    className="absolute inset-0 z-[2] rounded-md"
                  />
                  {image ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute right-1.5 bottom-1.5 z-[3] inline-flex items-center gap-1 rounded-full bg-bg/85 px-2 py-0.5 text-[0.7rem] text-foreground"
                    >
                      <Move className="size-3" /> Enquadrar
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-2.5">
                  <Label htmlFor="entry-name" className="sr-only">
                    Nome do item
                  </Label>
                  <input
                    id="entry-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoFocus
                    autoComplete="off"
                    maxLength={160}
                    placeholder="Nome do item"
                    className="display w-full min-w-0 border-0 border-b border-line-hi bg-transparent pt-1 pb-2 text-[1.45rem] leading-tight text-foreground outline-none transition-colors placeholder:text-faint focus:border-brand focus-visible:outline-none"
                  />

                  {ratingEnabled ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StarInput value={rating} onChange={setRating} />
                      <span className="display w-9 text-lg">
                        {rating > 0 ? formatRating(rating) : "—"}
                      </span>
                      {rating > 0 ? (
                        <button
                          type="button"
                          onClick={() => setRating(0)}
                          title="Limpar avaliação"
                          aria-label="Limpar avaliação"
                          className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-hi hover:text-foreground"
                        >
                          <Eraser className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {canChangeCategory || canChangeFolder ? (
                    <button
                      type="button"
                      onClick={() => setPlaceOpen((current) => !current)}
                      aria-expanded={placeOpen}
                      aria-controls="entry-place"
                      title="Onde o item fica"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
                    >
                      {placeLabel}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-3 shrink-0 transition-transform",
                          placeOpen && "rotate-180"
                        )}
                      />
                    </button>
                  ) : placeName ? (
                    <p className="flex max-w-full text-xs text-faint">{placeLabel}</p>
                  ) : null}
                </div>
              </div>

              {placeOpen ? (
                <div
                  id="entry-place"
                  className="grid gap-3 rounded-xl border border-line bg-surface p-3.5 sm:grid-cols-2"
                >
                  {canChangeCategory ? (
                    <div className="space-y-1.5">
                      <label htmlFor="entry-category" className="plaque block">
                        Categoria
                      </label>
                      <select
                        id="entry-category"
                        value={categoryId}
                        onChange={(event) => {
                          const target = categories.find((item) => item.id === event.target.value)
                          if (target && target.id !== categoryId) setMoveTo(target)
                        }}
                        disabled={pending}
                        className={SELECT_CLASS}
                      >
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.icon ? `${item.icon} ` : ""}
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {canChangeFolder ? (
                    <div className="space-y-1.5">
                      <label htmlFor="entry-folder" className="plaque block">
                        Subpasta
                      </label>
                      <select
                        id="entry-folder"
                        value={folderId ?? ROOT}
                        onChange={(event) =>
                          setFolderId(event.target.value === ROOT ? null : event.target.value)
                        }
                        className={SELECT_CLASS}
                      >
                        {folderOptions.map((option) => (
                          <option key={option.id ?? ROOT} value={option.id ?? ROOT}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {imageOpen ? (
                <div
                  id="entry-image-panel"
                  className="space-y-3 rounded-xl border border-line bg-surface p-3.5"
                >
                  {image ? (
                    <ImageFramer
                      imageUrl={image}
                      initial={initial}
                      framing={framing}
                      onChange={setFraming}
                    />
                  ) : null}
                  <div className="space-y-1.5">
                    <label htmlFor="entry-image" className="plaque block">
                      Link da imagem
                    </label>
                    <Input
                      id="entry-image"
                      value={imageUrl}
                      onChange={(event) => {
                        setImageUrl(event.target.value)
                        // Imagem nova começa centrada: o enquadramento era da outra.
                        setFraming(DEFAULT_FRAMING)
                      }}
                      placeholder="https://…"
                      inputMode="url"
                      autoComplete="off"
                      autoFocus={!image}
                    />
                    {image ? null : (
                      <p className="text-xs leading-relaxed text-faint">
                        Cole o endereço de uma imagem já hospedada. Nada é enviado nem copiado.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {image ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFraming(DEFAULT_FRAMING)}
                        >
                          Centralizar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setImageUrl("")
                            setFraming(DEFAULT_FRAMING)
                          }}
                        >
                          Remover
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setImageOpen(false)}
                    >
                      <Check className="size-4" /> Pronto
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {estrutura.length > 0 ? (
              <section className="space-y-3" aria-labelledby="entry-fields-title">
                <h3 id="entry-fields-title" className="plaque [overflow-wrap:anywhere]">
                  {placeName ? `Campos de ${placeName}` : "Campos desta categoria"}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {estrutura.map((field) => (
                    <div key={field.id} className="min-w-0 space-y-1.5">
                      <Label
                        htmlFor={`field-${field.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {field.nome}
                      </Label>
                      <FieldInput
                        field={field}
                        value={values[field.id] ?? ""}
                        onChange={(next) => setValue(field.id, next)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-2.5" aria-labelledby="entry-tags-title">
              <h3 id="entry-tags-title" className="plaque">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <TagPill
                    key={tag.id}
                    tag={tag}
                    active={tagIds.includes(tag.id)}
                    onClick={() =>
                      setTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((id) => id !== tag.id)
                          : [...current, tag.id]
                      )
                    }
                  />
                ))}

                {!creatingTag ? (
                  <button
                    type="button"
                    onClick={() => setCreatingTag(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"
                  >
                    <Plus className="size-3" /> nova tag
                  </button>
                ) : null}
              </div>

              {creatingTag ? (
                <div className="space-y-2 rounded-lg border border-line bg-bg-soft p-3">
                  <Input
                    value={newTagName}
                    onChange={(event) => setNewTagName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void addTag()
                      }
                    }}
                    placeholder="Nome da tag"
                    maxLength={40}
                    autoFocus
                  />
                  <ColorPalette value={newTagColor} onChange={setNewTagColor} />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCreatingTag(false)
                        setNewTagName("")
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addTag}
                      disabled={pending || !newTagName.trim()}
                    >
                      Criar e aplicar
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row items-center gap-2 px-5 py-3 sm:justify-between">
            <span className="mr-auto min-w-0 text-xs text-faint">
              {estrutura.length > 0 ? `${filled} de ${estrutura.length} campos` : null}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar item"}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {/* Trocar de categoria: o que vai junto e o que fica, antes de mover. */}
        <ConfirmDialog
          open={moveTo !== null}
          onOpenChange={(next) => {
            if (!next) setMoveTo(null)
          }}
          title={moveTo ? `Mover para “${moveTo.name}”` : "Mover"}
          description={moveTo ? moveDescription(moveTo) : null}
          confirmLabel="Mover"
          pendingLabel="Movendo…"
          destructive={false}
          onConfirm={() => (moveTo ? moveToCategory(moveTo) : undefined)}
        />
      </DialogContent>
    </Dialog>
  )

  /** O texto do diálogo de mover: o que fica para trás, o que vai junto e a nota. */
  function moveDescription(target: CategorySummary) {
    const summary = moveSummary(
      estrutura,
      target.estrutura,
      values,
      ratingEnabled && rating > 0 ? rating : null,
      target.rating_enabled
    )
    const names = (fields: { nome: string }[]) => fields.map((field) => field.nome).join(", ")
    return (
      <>
        {summary.dropped.length > 0 ? (
          <p className="text-foreground">
            {summary.dropped.length === 1
              ? `Fica para trás: ${names(summary.dropped)} — “${target.name}” não tem esse campo.`
              : `Ficam para trás ${summary.dropped.length} campos: ${names(summary.dropped)} — “${target.name}” não tem esses campos.`}
          </p>
        ) : (
          <p>Nenhum campo preenchido se perde.</p>
        )}
        {summary.kept.length > 0 ? <p>Vão junto: {names(summary.kept)}.</p> : null}
        {summary.ratingLost ? (
          <p className="text-foreground">
            A nota ({formatRating(rating)}) some: “{target.name}” não usa estrelas.
          </p>
        ) : null}
        <p>
          Nome, imagem e tags vão junto, e o que você mudou aqui é salvo antes. O item chega na raiz
          de “{target.name}” e abre para você completar.
        </p>
      </>
    )
  }
}
