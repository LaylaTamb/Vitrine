"use client"

import { Eraser, ImageOff, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { EntryImage } from "@/components/entry/entry-image"
import { FieldInput } from "@/components/entry/field-input"
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
import { imageTransformOf } from "@/lib/domain/view"

const DEFAULT_FRAMING = { x: 50, y: 50, zoom: 1 }
const ROOT = "__raiz__"

export function EntryForm({
  open,
  onOpenChange,
  categoryId,
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
      entry
        ? { x: entry.imageX, y: entry.imageY, zoom: entry.imageZoom }
        : DEFAULT_FRAMING
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
    const result = await actions.createTag({ name: newTagName, color: newTagColor })
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
      imageDisplay: framing,
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
      (field) =>
        (values[field.id] ?? "").trim() !== String(entry?.values[field.id] ?? "").trim()
    )
    if (savedId && addressChanged) void geocodeAfterSave(actions, savedId)
  }

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {editing ? "Editar item" : "Novo item"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {ratingEnabled
                ? "Nome, imagem e avaliação toda categoria tem. O resto vem da estrutura desta aqui."
                : "Nome e imagem toda categoria tem. O resto vem da estrutura desta aqui — esta lista não usa estrelas."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4 md:grid-cols-[1fr_2fr]">
            {/* ---------------- coluna esquerda: imagem ---------------- */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="entry-image" className="plaque">
                  Imagem (link)
                </Label>
                <Input
                  id="entry-image"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
                <p className="text-xs leading-relaxed text-faint">
                  Cole o endereço de uma imagem já hospedada. Nada é enviado nem copiado.
                </p>
              </div>

              {imageUrl.trim() ? (
                <EntryImage
                  imageUrl={imageUrl.trim()}
                  imageTransform={imageTransformOf(framing)}
                  initial={(name.trim()[0] ?? "?").toUpperCase()}
                  eager
                />
              ) : (
                <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line text-faint">
                  <ImageOff className="size-5" />
                  <span className="text-xs">Sem imagem</span>
                </div>
              )}

              <div className="space-y-2">
                <Slider
                  label="Horiz."
                  value={framing.x}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(x) => setFraming((current) => ({ ...current, x }))}
                />
                <Slider
                  label="Vert."
                  value={framing.y}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(y) => setFraming((current) => ({ ...current, y }))}
                />
                <Slider
                  label="Zoom"
                  value={framing.zoom}
                  min={1}
                  max={3}
                  step={0.05}
                  onChange={(zoom) => setFraming((current) => ({ ...current, zoom }))}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
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
              </div>
            </div>

            {/* ---------------- coluna direita ---------------- */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="entry-name" className="plaque">
                  Nome do item
                </Label>
                <Input
                  id="entry-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                  maxLength={160}
                  placeholder="Kinoshita"
                />
              </div>

              {editing && categories.length > 1 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="entry-category" className="plaque">
                    Categoria
                  </Label>
                  <select
                    id="entry-category"
                    value={categoryId}
                    onChange={(event) => {
                      const target = categories.find((item) => item.id === event.target.value)
                      if (target && target.id !== categoryId) setMoveTo(target)
                    }}
                    disabled={pending}
                    className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
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

              {folderOptions.length > 1 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="entry-folder" className="plaque">
                    Pasta
                  </Label>
                  <select
                    id="entry-folder"
                    value={folderId ?? ROOT}
                    onChange={(event) =>
                      setFolderId(event.target.value === ROOT ? null : event.target.value)
                    }
                    className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
                  >
                    {folderOptions.map((option) => (
                      <option key={option.id ?? ROOT} value={option.id ?? ROOT}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {ratingEnabled ? (
              <div className="space-y-1.5">
                <span className="plaque block">Avaliação</span>
                <div className="flex items-center gap-3">
                  <StarInput value={rating} onChange={setRating} />
                  <span className="display w-10 text-lg">
                    {rating > 0 ? formatRating(rating) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRating(0)}
                    title="Limpar avaliação"
                    aria-label="Limpar avaliação"
                    className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-hi hover:text-foreground"
                  >
                    <Eraser className="size-4" />
                  </button>
                </div>
              </div>
              ) : null}

              <div className="space-y-2">
                <span className="plaque block">Tags</span>
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
              </div>

              {estrutura.length > 0 ? (
                <div className="space-y-2">
                  <span className="plaque block">Campos desta categoria</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {estrutura.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <Label htmlFor={`field-${field.id}`} className="text-xs text-muted-foreground">
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
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
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
          Nome, imagem e tags vão junto, e o que você mudou aqui é salvo antes. O item chega na
          raiz de “{target.name}” e abre para você completar.
        </p>
      </>
    )
  }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-brand"
      />
    </label>
  )
}
