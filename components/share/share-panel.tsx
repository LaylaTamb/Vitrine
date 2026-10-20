"use client"

import { ArrowLeft, Plus, Search, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { StarInput } from "@/components/entry/stars"
import { FieldInput } from "@/components/entry/field-input"
import { geocodeAfterSave } from "@/components/map/geocode-runner"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizeTitle } from "@/lib/domain/catalog"
import { formatRating } from "@/lib/domain/format"
import { isInbox } from "@/lib/domain/inbox"
import { QUICK_FIELD_NAME, QUICK_FIELD_RATING, quickFieldOf } from "@/lib/domain/quick-field"
import { iconForCategoryName } from "@/lib/domain/share"
import type { Category } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** Quantas categorias aparecem antes do "Ver todas" (sem busca). */
const VISIBLE = 6

const DEFAULT_FRAMING = { x: 50, y: 50, zoom: 1 }

/** O que `save` precisa saber da categoria de destino. */
type Target = Pick<Category, "id" | "name" | "estrutura" | "rating_enabled" | "quick_field">

/**
 * O painel do acesso rápido: o que chegou vira o Nome, e um toque numa
 * categoria salva. Se a categoria tem campo principal (≠ Nome), o painel
 * pede só ele — dá para pular. "Nova categoria" cria com o nome, estrelas
 * ligadas e um ícone pela palavra-chave, e já salva lá.
 */
export function SharePanel({
  initialName,
  categories,
  suggestedId,
}: {
  initialName: string
  /** Na ordem do painel: recentes primeiro. */
  categories: Category[]
  suggestedId: string | null
}) {
  const { actions, basePath, isDemo } = useVitrine()
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [query, setQuery] = useState("")
  const [showAll, setShowAll] = useState(false)
  const [asking, setAsking] = useState<Category | null>(null)
  const [quickValue, setQuickValue] = useState("")
  const [creating, setCreating] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [pending, setPending] = useState(false)

  const inbox = categories.find(isInbox) ?? null
  const suggested =
    suggestedId && suggestedId !== inbox?.id
      ? (categories.find((category) => category.id === suggestedId) ?? null)
      : null

  const list = useMemo(() => {
    const rest = categories.filter(
      (category) => category.id !== inbox?.id && category.id !== suggested?.id
    )
    const needle = normalizeTitle(query)
    if (needle) return rest.filter((category) => normalizeTitle(category.name).includes(needle))
    return showAll ? rest : rest.slice(0, VISIBLE)
  }, [categories, inbox, suggested, query, showAll])
  const hidden = categories.length - (inbox ? 1 : 0) - (suggested ? 1 : 0) - list.length

  const trimmed = name.trim()

  function choose(category: Category) {
    if (!trimmed) {
      toast.error("Escreva um nome para o item.")
      return
    }
    const quick = quickFieldOf(category)
    if (quick === QUICK_FIELD_NAME) {
      void save(category, "")
      return
    }
    setQuickValue("")
    setAsking(category)
  }

  async function save(category: Target, value: string) {
    const quick = quickFieldOf(category)
    const customFields =
      value && quick !== QUICK_FIELD_NAME && quick !== QUICK_FIELD_RATING ? { [quick]: value } : {}
    const rating =
      category.rating_enabled && quick === QUICK_FIELD_RATING && Number(value) > 0
        ? Number(value)
        : null

    setPending(true)
    const result = await actions.createEntry({
      categoryId: category.id,
      name: trimmed,
      rating,
      imageUrl: null,
      imageDisplay: DEFAULT_FRAMING,
      customFields,
      tagIds: [],
    })
    if (!result.ok) {
      setPending(false)
      toast.error(result.error)
      return
    }

    const entryId = (result.data as { id?: string } | undefined)?.id
    toast.success(`Salvo em “${category.name}”.`, {
      action: entryId
        ? {
            label: "Desfazer",
            onClick: async () => {
              const undone = await actions.deleteEntry({ id: entryId, categoryId: category.id })
              if (undone.ok) toast("Desfeito: o item saiu de lá.")
              else toast.error(undone.error)
            },
          }
        : undefined,
    })
    // Endereço no campo principal: procura no mapa em segundo plano.
    const field = category.estrutura.find((item) => item.id === quick)
    if (!isDemo && entryId && field?.tipo === "location" && value.trim()) {
      void geocodeAfterSave(actions, entryId)
    }
    router.replace(`${basePath}/categoria/${category.id}`)
  }

  async function createAndSave() {
    const categoryName = newCategory.trim()
    if (!trimmed) {
      toast.error("Escreva um nome para o item.")
      return
    }
    if (!categoryName) return
    setPending(true)
    const created = await actions.createCategory({
      name: categoryName,
      icon: iconForCategoryName(categoryName),
      color: null,
      folderId: null,
      estrutura: [],
      ratingEnabled: true,
      defaultSort: "rating_desc",
    })
    if (!created.ok) {
      setPending(false)
      toast.error(created.error)
      return
    }
    const id = (created.data as { id?: string } | undefined)?.id
    if (!id) {
      setPending(false)
      return
    }
    await save(
      { id, name: categoryName, estrutura: [], rating_enabled: true, quick_field: QUICK_FIELD_NAME },
      ""
    )
  }

  // ---- passo 2: o campo principal da categoria escolhida -------------------
  if (asking) {
    const quick = quickFieldOf(asking)
    const field = asking.estrutura.find((item) => item.id === quick) ?? null
    return (
      <div className="mx-auto max-w-md space-y-5 py-8">
        <button
          type="button"
          onClick={() => setAsking(null)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Escolher outra categoria
        </button>
        <div className="space-y-1">
          <p className="plaque">
            {asking.icon ? `${asking.icon} ` : ""}
            {asking.name}
          </p>
          <h1 className="display text-2xl leading-tight break-words">{trimmed}</h1>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={field ? `field-${field.id}` : undefined} className="plaque">
            {quick === QUICK_FIELD_RATING ? "Avaliação" : (field?.nome ?? "")}
          </Label>
          {quick === QUICK_FIELD_RATING ? (
            <div className="flex items-center gap-3">
              <StarInput
                value={Number(quickValue || 0)}
                onChange={(next) => setQuickValue(next ? String(next) : "")}
              />
              <span className="text-sm text-muted-foreground">
                {quickValue ? formatRating(Number(quickValue)) : "—"}
              </span>
            </div>
          ) : field ? (
            <FieldInput field={field} value={quickValue} onChange={setQuickValue} autoFocus />
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            className="h-11 flex-1"
            disabled={pending}
            onClick={() => save(asking, quickValue)}
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            variant="ghost"
            className="h-11"
            disabled={pending}
            onClick={() => save(asking, "")}
          >
            Pular
          </Button>
        </div>
      </div>
    )
  }

  // ---- passo 1: onde guardar ------------------------------------------------
  return (
    <div className="mx-auto max-w-md space-y-5 py-8">
      <div className="space-y-1">
        <p className="plaque">Acesso rápido</p>
        <h1 className="display text-2xl">Salvar no Vitrine</h1>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="share-name" className="plaque">
          Nome
        </Label>
        <Input
          id="share-name"
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
          placeholder="O que você quer guardar?"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <p className="plaque">Salvar em…</p>

        {suggested ? (
          <Destination
            category={suggested}
            note="Sugestão"
            highlight
            disabled={pending}
            onChoose={choose}
          />
        ) : null}
        {inbox ? (
          <Destination
            category={inbox}
            note="Para organizar depois"
            disabled={pending}
            onChoose={choose}
          />
        ) : null}

        {categories.length > VISIBLE + 2 ? (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar categoria"
              aria-label="Buscar categoria"
              className="h-10 pl-9"
            />
          </div>
        ) : null}

        {list.map((category) => (
          <Destination
            key={category.id}
            category={category}
            disabled={pending}
            onChoose={choose}
          />
        ))}

        {!query && !showAll && hidden > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Ver todas ({hidden} a mais)
          </button>
        ) : null}

        {creating ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void createAndSave()
            }}
            className="flex items-center gap-2 rounded-lg border border-dashed border-line p-2"
          >
            <span aria-hidden className="w-7 shrink-0 text-center text-lg">
              {newCategory.trim() ? iconForCategoryName(newCategory) : "＋"}
            </span>
            <Input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="Nome da categoria"
              aria-label="Nome da nova categoria"
              maxLength={80}
              autoFocus
              className="h-9"
            />
            <Button type="submit" disabled={pending || !newCategory.trim()}>
              Criar e salvar
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={pending}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
          >
            <Plus className="size-4" /> Nova categoria
          </button>
        )}
      </div>
    </div>
  )
}

/** Uma categoria de destino: um toque e salva (ou pede o campo principal). */
function Destination({
  category,
  note,
  highlight = false,
  disabled,
  onChoose,
}: {
  category: Category
  note?: string
  highlight?: boolean
  disabled: boolean
  onChoose: (category: Category) => void
}) {
  const quick = quickFieldOf(category)
  const asks =
    quick === QUICK_FIELD_RATING
      ? "pede a nota"
      : quick !== QUICK_FIELD_NAME
        ? `pede ${category.estrutura.find((field) => field.id === quick)?.nome ?? "um campo"}`
        : null
  return (
    <button
      type="button"
      onClick={() => onChoose(category)}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-wait",
        highlight
          ? "border-brand-dim bg-brand-wash hover:border-brand"
          : "border-line bg-surface hover:border-line-hi"
      )}
    >
      <span aria-hidden className="w-7 shrink-0 text-center text-lg">
        {category.icon ?? "▫"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{category.name}</span>
        {note || asks ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {highlight ? <Sparkles aria-hidden className="size-3 text-brand" /> : null}
            {[note, asks].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
    </button>
  )
}
