"use client"

import { Eraser, ImageOff, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { createEntryAction, updateEntryAction } from "@/app/categoria/[categoryId]/actions"
import { createTagAction } from "@/app/tags/actions"
import { EntryImage } from "@/components/entry/entry-image"
import { StarInput } from "@/components/entry/stars"
import { ColorPalette } from "@/components/tag/color-palette"
import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
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
import { formatRating } from "@/lib/domain/format"
import { DEFAULT_TAG_COLOR } from "@/lib/domain/tags"
import type { EntryView, Estrutura, Tag } from "@/lib/domain/types"
import { imageTransformOf } from "@/lib/domain/view"

const DEFAULT_FRAMING = { x: 50, y: 50, zoom: 1 }

export function EntryForm({
  open,
  onOpenChange,
  categoryId,
  estrutura,
  tags,
  entry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  estrutura: Estrutura
  tags: Tag[]
  /** Sem `entry` = novo item. */
  entry?: EntryView | null
}) {
  const editing = Boolean(entry)

  const [name, setName] = useState("")
  const [rating, setRating] = useState(0)
  const [imageUrl, setImageUrl] = useState("")
  const [framing, setFraming] = useState(DEFAULT_FRAMING)
  const [values, setValues] = useState<Record<string, string>>({})
  const [tagIds, setTagIds] = useState<string[]>([])
  const [extraTags, setExtraTags] = useState<Tag[]>([])
  const [pending, setPending] = useState(false)

  const [creatingTag, setCreatingTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR)

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
    setCreatingTag(false)
    setNewTagName("")
    setNewTagColor(DEFAULT_TAG_COLOR)
  }, [open, entry])

  function setValue(fieldId: string, value: string) {
    setValues((current) => ({ ...current, [fieldId]: value }))
  }

  async function addTag() {
    if (!newTagName.trim()) return
    setPending(true)
    const result = await createTagAction({ name: newTagName, color: newTagColor })
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

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("Dê um nome ao item.")
      return
    }

    const payload = {
      categoryId,
      name: name.trim(),
      rating: rating > 0 ? rating : null,
      imageUrl: imageUrl.trim() || null,
      imageDisplay: framing,
      customFields: values,
      tagIds,
    }

    setPending(true)
    const result = entry
      ? await updateEntryAction({ ...payload, id: entry.id })
      : await createEntryAction(payload)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(editing ? "Item salvo." : "Item adicionado.")
    onOpenChange(false)
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
              Nome, imagem e avaliação toda categoria tem. O resto vem da estrutura desta aqui.
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

                        {field.tipo === "star" ? (
                          <div className="flex items-center gap-2">
                            <StarInput
                              size="md"
                              value={Number(values[field.id] ?? 0)}
                              onChange={(value) => setValue(field.id, value ? String(value) : "")}
                            />
                            <span className="text-xs text-muted-foreground">
                              {values[field.id] ? formatRating(Number(values[field.id])) : "—"}
                            </span>
                          </div>
                        ) : field.tipo === "select" ? (
                          <select
                            id={`field-${field.id}`}
                            value={values[field.id] ?? ""}
                            onChange={(event) => setValue(field.id, event.target.value)}
                            className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
                          >
                            <option value="">—</option>
                            {(field.opcoes ?? []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`field-${field.id}`}
                            type={
                              field.tipo === "int" || field.tipo === "time"
                                ? "number"
                                : field.tipo === "date"
                                  ? "date"
                                  : "text"
                            }
                            step={field.tipo === "int" || field.tipo === "time" ? 1 : undefined}
                            inputMode={
                              field.tipo === "int" || field.tipo === "time" ? "numeric" : undefined
                            }
                            placeholder={field.tipo === "time" ? "minutos" : undefined}
                            value={values[field.id] ?? ""}
                            onChange={(event) => setValue(field.id, event.target.value)}
                          />
                        )}
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
      </DialogContent>
    </Dialog>
  )
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
