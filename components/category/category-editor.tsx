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
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Plus,
  SlidersHorizontal,
  Star,
  Type,
  WandSparkles,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { searchTemplatesAction } from "@/app/explorar/actions"
import { CategoryColorPicker } from "@/components/category/category-color-picker"
import { FieldRow } from "@/components/category/field-row"
import { FieldSuggestions } from "@/components/category/field-suggestions"
import { FIELD_TYPE_ICONS } from "@/components/category/field-type-icon"
import { IconPicker } from "@/components/category/icon-picker"
import { TemplatePicker } from "@/components/category/template-picker"
import { VisibilityPicker } from "@/components/collection/privacy-switch"
import { runPendingGeocode } from "@/components/map/geocode-runner"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { SUGGEST_MIN_NAME } from "@/lib/domain/field-suggestions"
import {
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
  FIELD_TYPE_EXAMPLES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_ORDER,
  FIELD_TYPE_SHORT_LABELS,
  convertibleTypesOf,
  diffEstrutura,
  diffFieldOptions,
  guessFieldType,
  newFieldId,
  parseEstruturaJSON,
  parseOptions,
  serializeEstrutura,
  validateField,
} from "@/lib/domain/fields"
import { isRatingSort, SORT_SHORT_LABELS, sortOptionsFor, type SortKey } from "@/lib/domain/filter"
import { plural } from "@/lib/domain/format"
import { visibilityHint, type Visibility } from "@/lib/domain/privacy"
import { normalizeQuickField, QUICK_FIELD_NAME, quickFieldOptions } from "@/lib/domain/quick-field"
import { colorLabel } from "@/lib/domain/tags"
import { normalizeCategoryName, type CategoryTemplate } from "@/lib/domain/templates"
import { FIELD_TYPES, type Estrutura, type FieldDef, type FieldType } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export interface CategoryEditorValue {
  id?: string
  name: string
  icon: string | null
  color: string | null
  estrutura: Estrutura
  /** `false` = lista simples, sem nota de estrelas. */
  ratingEnabled: boolean
  defaultSort: SortKey
  /** O campo principal do acesso rápido ("name", "rating" ou id de campo). */
  quickField: string
}

/** O ponto de partida de uma categoria nova. */
export const NEW_CATEGORY: CategoryEditorValue = {
  name: "",
  icon: null,
  color: null,
  estrutura: [],
  ratingEnabled: true,
  defaultSort: "rating_desc",
  quickField: QUICK_FIELD_NAME,
}

interface ImpactLine {
  text: string
}

/** Uma etiqueta que só mostra (os campos que toda categoria já tem). */
const STATIC_CHIP =
  "inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-faint"

/**
 * Criar ou editar uma categoria. Abre com o essencial (ícone, nome, campos e
 * quem vê); o que tem um bom padrão (cor, nota, ordem, acesso rápido e o
 * JSON) fica em "Personalizar", com o que está valendo resumido numa linha.
 * Ao criar, os modelos parecidos aparecem enquanto o nome é digitado.
 */
export function CategoryEditor({
  open,
  onOpenChange,
  initial,
  folderId = null,
  folderName = null,
  onSaved,
  defaultVisibility = "public",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem `id` = criar. Com `id` = editar. */
  initial: CategoryEditorValue
  folderId?: string | null
  /** A pasta onde a categoria nova nasce, para o subtítulo. */
  folderName?: string | null
  onSaved?: (id?: string) => void
  /** Ao criar, o padrão do perfil; ao editar, quem vê a categoria agora. */
  defaultVisibility?: Visibility
}) {
  const { actions } = useVitrine()
  const editing = Boolean(initial.id)
  // Modelos e sugestões de campos: só ao criar.
  const canUseTemplates = !editing

  /** "templates" = escolhendo um modelo (no lugar do formulário). */
  const [view, setView] = useState<"form" | "templates">("form")
  /** O modelo usado: a categoria nova lembra de onde veio (migração 25). */
  const [source, setSource] = useState<{ id: string; name: string; username: string } | null>(null)
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon ?? "")
  const [color, setColor] = useState<string | null>(initial.color)
  const [fields, setFields] = useState<Estrutura>(initial.estrutura)
  const [ratingEnabled, setRatingEnabled] = useState(initial.ratingEnabled)
  const [defaultSort, setDefaultSort] = useState<SortKey>(initial.defaultSort)
  const [quickField, setQuickField] = useState(initial.quickField)
  const [visibility, setVisibility] = useState(defaultVisibility)
  const [moreOpen, setMoreOpen] = useState(false)

  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  // O campo sendo criado ou editado (o "compositor", abaixo da lista).
  const [composerOpen, setComposerOpen] = useState(false)
  /** Id do campo sendo editado — `null` quando o compositor é "adicionar". */
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<FieldType>("str")
  /** O tipo ainda é o palpite pelo nome (a pessoa não tocou nos botões). */
  const [typeGuessed, setTypeGuessed] = useState(true)
  const [newOptions, setNewOptions] = useState<string[]>([])
  const [optionDraft, setOptionDraft] = useState("")
  const [newCurrency, setNewCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [fieldError, setFieldError] = useState<string | null>(null)
  /** O campo que acabou de entrar: acende por um instante. */
  const [flashId, setFlashId] = useState<string | null>(null)

  /** Os modelos com nome parecido com o digitado (até 2). */
  const [nameMatches, setNameMatches] = useState<{
    key: string
    templates: CategoryTemplate[]
  } | null>(null)

  const [pending, setPending] = useState(false)
  const [impact, setImpact] = useState<ImpactLine[] | null>(null)
  const [pendingEstrutura, setPendingEstrutura] = useState<{
    estrutura: Estrutura
    removedFieldIds: string[]
    /** Algum Texto virou Localização com endereços já escritos: procurar depois de salvar. */
    geocode: boolean
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // `initial` costuma ser um objeto literal criado pelo pai, então a
  // identidade muda a cada render dele. O reset tem que depender só de `open`:
  // com `initial` na lista, qualquer render do pai apagaria o que está sendo
  // digitado aqui dentro.
  const initialRef = useRef(initial)
  initialRef.current = initial
  const defaultVisibilityRef = useRef(defaultVisibility)
  defaultVisibilityRef.current = defaultVisibility
  const optionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const current = initialRef.current
    setView("form")
    setSource(null)
    setName(current.name)
    setIcon(current.icon ?? "")
    setColor(current.color)
    setFields(current.estrutura)
    setRatingEnabled(current.ratingEnabled)
    setDefaultSort(current.defaultSort)
    setQuickField(current.quickField)
    setVisibility(defaultVisibilityRef.current)
    setMoreOpen(false)
    setJsonOpen(false)
    setNameMatches(null)
    setFlashId(null)
    setComposerOpen(false)
    setEditingFieldId(null)
    setFieldError(null)
    setImpact(null)
  }, [open])

  useEffect(() => {
    if (!flashId) return
    const timer = setTimeout(() => setFlashId(null), 900)
    return () => clearTimeout(timer)
  }, [flashId])

  // Modelos parecidos com o nome digitado: só ao criar, sem modelo em uso.
  const nameKey = normalizeCategoryName(name)
  useEffect(() => {
    if (!open || editing || source || nameKey.length < SUGGEST_MIN_NAME) return
    let alive = true
    const timer = setTimeout(async () => {
      const result = await searchTemplatesAction({ query: nameKey, sort: "relevance" })
      if (!alive) return
      setNameMatches({ key: nameKey, templates: result.ok ? (result.data ?? []).slice(0, 2) : [] })
    }, 500)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [open, editing, source, nameKey])
  const matches =
    nameMatches && nameMatches.key === nameKey && nameKey.length >= SUGGEST_MIN_NAME
      ? nameMatches.templates
      : []

  /**
   * "Usar" um modelo: traz nome, ícone, cor, estrelas, ordem padrão, campo
   * principal e os campos COM OS MESMOS IDS — e volta para o formulário, para
   * a pessoa mudar o que quiser antes de criar.
   */
  function applyTemplate(template: CategoryTemplate) {
    setName(template.name)
    setIcon(template.icon ?? "")
    setColor(template.color)
    setFields(template.estrutura)
    setRatingEnabled(template.ratingEnabled)
    setDefaultSort(template.defaultSort)
    setQuickField(template.quickField)
    closeComposer()
    setSource({ id: template.id, name: template.name, username: template.owner.username })
    setView("form")
  }

  /** Volta ao ponto de partida (desfaz o modelo). */
  function clearTemplate() {
    const current = initialRef.current
    setName(current.name)
    setIcon(current.icon ?? "")
    setColor(current.color)
    setFields(current.estrutura)
    setRatingEnabled(current.ratingEnabled)
    setDefaultSort(current.defaultSort)
    setQuickField(current.quickField)
    closeComposer()
    setSource(null)
  }

  // ------------------------------------------------------------ o compositor

  function openNewField() {
    setEditingFieldId(null)
    setNewName("")
    setNewType("str")
    setTypeGuessed(true)
    setNewOptions([])
    setOptionDraft("")
    setNewCurrency(DEFAULT_CURRENCY)
    setFieldError(null)
    setComposerOpen(true)
  }

  function startEditField(field: FieldDef) {
    setEditingFieldId(field.id)
    setNewName(field.nome)
    setNewType(field.tipo)
    setTypeGuessed(false)
    setNewOptions(field.opcoes ?? [])
    setOptionDraft("")
    setNewCurrency(field.moeda ?? DEFAULT_CURRENCY)
    setFieldError(null)
    setComposerOpen(true)
  }

  function closeComposer() {
    setComposerOpen(false)
    setEditingFieldId(null)
    setFieldError(null)
  }

  /** O nome primeiro: enquanto a pessoa não escolhe, o tipo segue o palpite. */
  function changeFieldName(value: string) {
    setNewName(value)
    setFieldError(null)
    if (typeGuessed && !editingFieldId) setNewType(guessFieldType(value))
  }

  /** As opções da lista, com o que ainda está sendo digitado. */
  function currentOptions(): string[] {
    return parseOptions([...newOptions, optionDraft].join("\n"))
  }

  function commitOptionDraft() {
    if (!optionDraft.trim()) return
    setNewOptions(currentOptions())
    setOptionDraft("")
  }

  /**
   * Os tipos que o campo em edição pode assumir. O tipo de um campo que já
   * existe (salvo) fica travado — mudar o tipo estragaria os valores
   * gravados —, com uma exceção: Texto pode virar Localização (e voltar,
   * antes de salvar). `null` = livre (campo novo).
   */
  function editableTypesOf(fieldId: string | null): FieldType[] | null {
    if (!fieldId) return null
    const saved = initial.estrutura.find((field) => field.id === fieldId)
    return saved ? convertibleTypesOf(saved.tipo) : null
  }

  /** Grava o compositor na lista e devolve a lista nova; `null` = não deu (o erro aparece nele). */
  function saveComposer(): Estrutura | null {
    const allowed = editableTypesOf(editingFieldId)
    const current = editingFieldId ? fields.find((field) => field.id === editingFieldId) : null
    const tipo = !allowed || allowed.includes(newType) ? newType : (current?.tipo ?? newType)
    const opcoes = tipo === "select" ? currentOptions() : []
    const error = validateField(fields, newName, tipo, opcoes, editingFieldId ?? undefined)
    if (error) {
      setFieldError(error)
      return null
    }
    const field: FieldDef = {
      id: editingFieldId ?? newFieldId(),
      nome: newName.trim(),
      tipo,
      ...(tipo === "select" ? { opcoes } : {}),
      ...(tipo === "currency" ? { moeda: newCurrency } : {}),
    }
    const next = editingFieldId
      ? fields.map((item) => (item.id === editingFieldId ? field : item))
      : [...fields, field]
    setFields(next)
    setFlashId(field.id)
    closeComposer()
    return next
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = fields.findIndex((field) => field.id === active.id)
    const to = fields.findIndex((field) => field.id === over.id)
    if (from < 0 || to < 0) return
    setFields(arrayMove(fields, from, to))
  }

  function openJson() {
    setJsonText(serializeEstrutura(fields))
    setJsonError(null)
    setJsonOpen(true)
  }

  function applyJson() {
    const parsed = parseEstruturaJSON(jsonText, fields)
    if (!parsed.ok) {
      setJsonError(parsed.error)
      return
    }
    closeComposer()
    setFields(parsed.estrutura)
    setJsonOpen(false)
  }

  // ------------------------------------------------------------ salvar

  async function handleSave() {
    // Um campo pela metade no compositor: com nome, entra; vazio, some.
    let estrutura = fields
    if (composerOpen) {
      if (newName.trim()) {
        const next = saveComposer()
        if (!next) return
        estrutura = next
      } else closeComposer()
    }

    if (!name.trim()) {
      toast.error("Dê um nome à categoria.")
      return
    }

    // Criar não mexe em item nenhum: salva direto.
    if (!editing) {
      await persist(estrutura, [])
      return
    }

    const diff = diffEstrutura(initial.estrutura, estrutura)
    const optionsDiff = diffFieldOptions(initial.estrutura, estrutura)
    const ratingTurnedOff = initial.ratingEnabled && !ratingEnabled
    if (
      diff.added.length === 0 &&
      diff.removed.length === 0 &&
      diff.retyped.length === 0 &&
      optionsDiff.length === 0 &&
      !ratingTurnedOff
    ) {
      // Só renomeou ou reordenou: com id estável, nada a avisar.
      await persist(estrutura, [])
      return
    }

    setPending(true)
    const result = await actions.structureImpact({
      categoryId: initial.id!,
      // Removidos: quantos perdem o valor. Trocados de tipo: quantos têm valor
      // ali (num Texto → Localização, quantos endereços vão ser procurados).
      fieldIds: [...diff.removed, ...diff.retyped.map((change) => change.field)].map(
        (field) => field.id
      ),
      fieldOptions: optionsDiff.map((entry) => ({
        fieldId: entry.fieldId,
        options: entry.removed,
      })),
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    const total = result.data?.total ?? 0
    const rated = result.data?.rated ?? 0
    const filled = result.data?.filled ?? {}
    const optionUsage = result.data?.optionUsage ?? {}

    // Nenhum item, ou só desligou as estrelas de quem não tinha nota: nada se perde.
    const onlyHarmlessRatingChange =
      ratingTurnedOff &&
      rated === 0 &&
      diff.added.length === 0 &&
      diff.removed.length === 0 &&
      diff.retyped.length === 0 &&
      optionsDiff.length === 0
    if (total === 0 || onlyHarmlessRatingChange) {
      await persist(
        estrutura,
        diff.removed.map((field) => field.id)
      )
      return
    }

    // Texto → Localização com endereços já escritos: eles são procurados
    // depois de salvar.
    const addressesToLocate = diff.retyped
      .filter((change) => change.to === "location")
      .reduce((sum, change) => sum + (filled[change.field.id] ?? 0), 0)

    const lines: ImpactLine[] = [
      ...(ratingTurnedOff && rated > 0
        ? [
            {
              text: `Avaliação desligada: ${plural(rated, "item vai perder", "itens vão perder")} a nota de estrelas permanentemente.`,
            },
          ]
        : []),
      ...diff.added.map((field) => ({
        text: `"${field.nome}": ${plural(total, "item existente fica", "itens existentes ficam")} com esse campo vazio.`,
      })),
      ...diff.removed.map((field) => {
        const count = filled[field.id] ?? 0
        return {
          text:
            count === 0
              ? `"${field.nome}": nenhum item tinha valor aqui.`
              : `"${field.nome}": ${plural(count, "item vai perder", "itens vão perder")} permanentemente esse valor.`,
        }
      }),
      ...optionsDiff.flatMap((entry) =>
        entry.removed.map((option) => {
          const count = optionUsage[entry.fieldId]?.[option] ?? 0
          return {
            text:
              count === 0
                ? `"${entry.nome}": a opção "${option}" sai da lista e nenhum item usava ela.`
                : `"${entry.nome}": a opção "${option}" sai da lista, mas ${plural(count, "item mantém", "itens mantêm")} esse valor gravado.`,
          }
        })
      ),
      ...diff.retyped.map(({ field, from, to }) => {
        const count = filled[field.id] ?? 0
        if (to !== "location") {
          return {
            text: `"${field.nome}": passa de “${FIELD_TYPE_LABELS[from]}” para “${FIELD_TYPE_LABELS[to]}”${from === "location" ? " e sai do mapa" : ""}.`,
          }
        }
        return {
          text:
            count === 0
              ? `"${field.nome}": vira Localização — nenhum item tem endereço aqui ainda.`
              : `"${field.nome}": ${plural(count, "endereço vai ser procurado", "endereços vão ser procurados")} para aparecer no mapa.`,
        }
      }),
    ]

    setPendingEstrutura({
      estrutura,
      removedFieldIds: diff.removed.map((field) => field.id),
      geocode: addressesToLocate > 0,
    })
    setImpact(lines)
  }

  async function persist(
    estrutura: Estrutura,
    removedFieldIds: string[],
    { geocode = false }: { geocode?: boolean } = {}
  ) {
    setPending(true)
    const result = editing
      ? await actions.updateCategory({
          id: initial.id!,
          name: name.trim(),
          icon: icon.trim() || null,
          color,
          estrutura,
          ratingEnabled,
          defaultSort,
          quickField,
          removedFieldIds,
        })
      : await actions.createCategory({
          name: name.trim(),
          icon: icon.trim() || null,
          color,
          folderId,
          estrutura,
          ratingEnabled,
          defaultSort,
          quickField,
          // Igual ao padrão: quem decide é o banco (vale também antes da migração 14).
          visibility: visibility === defaultVisibility ? undefined : visibility,
          ...(source ? { sourceCategoryId: source.id } : {}),
        })

    // Na edição, "Quem vê" grava pela mesma ação do selo no topo da categoria.
    const visibilityResult =
      result.ok && editing && visibility !== defaultVisibility
        ? await actions.setCategoryVisibility({ id: initial.id!, visibility })
        : null
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (visibilityResult && !visibilityResult.ok) {
      toast.error(`Salvo, mas “Quem vê” não mudou: ${visibilityResult.error}`)
    } else {
      toast.success(editing ? "Categoria atualizada." : "Categoria criada.")
    }
    setImpact(null)
    setPendingEstrutura(null)
    onOpenChange(false)
    onSaved?.(result.ok ? (result.data as { id?: string } | undefined)?.id : undefined)

    // A categoria já está salva; os endereços são procurados em seguida, em lotes.
    if (geocode && editing) {
      void runPendingGeocode(actions, { categoryId: initial.id!, mode: "pending" })
    }
  }

  // `null` = campo novo (qualquer tipo); editando um salvo, o que ele pode virar.
  const editTypes = editableTypesOf(editingFieldId)
  // Campo removido ou estrelas desligadas: o seletor já mostra o Nome (e o servidor grava assim).
  const effectiveQuickField = normalizeQuickField(quickField, fields, ratingEnabled)
  const summary = `${colorLabel(color)} · ${ratingEnabled ? "Com nota" : "Sem nota"} · Abre ${SORT_SHORT_LABELS[defaultSort]}`
  const choosingTemplate = view === "templates"

  const composer = (
    <div className="space-y-3 rounded-xl border border-brand-dim bg-surface p-3">
      <p className="plaque">{editingFieldId ? "Editar campo" : "Novo campo"}</p>
      <input
        value={newName}
        onChange={(event) => changeFieldName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          // Lista sem opções ainda: o Enter leva para as opções.
          if (newType === "select" && currentOptions().length === 0) {
            optionInputRef.current?.focus()
            return
          }
          saveComposer()
        }}
        aria-label="Nome do campo"
        placeholder="Nome do campo — ex.: Safra, Preço"
        maxLength={40}
        autoFocus
        className="h-10 w-full min-w-0 rounded-lg border border-line bg-bg-soft px-3 text-sm outline-none focus-visible:border-brand-dim focus-visible:outline-none"
      />

      <div role="radiogroup" aria-label="Tipo do campo" className="flex flex-wrap gap-1.5">
        {FIELD_TYPE_ORDER.map((type) => {
          const Icon = FIELD_TYPE_ICONS[type]
          const selected = newType === type
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              title={FIELD_TYPE_LABELS[type]}
              disabled={editTypes !== null && !editTypes.includes(type)}
              onClick={() => {
                setNewType(type)
                setTypeGuessed(false)
                setFieldError(null)
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                selected
                  ? "border-brand-dim bg-brand-wash text-foreground"
                  : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
              )}
            >
              <Icon aria-hidden className={cn("size-3.5 shrink-0", selected && "text-brand")} />
              {FIELD_TYPE_SHORT_LABELS[type]}
            </button>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="text-foreground">{FIELD_TYPE_LABELS[newType]}</span> ·{" "}
        {FIELD_TYPE_EXAMPLES[newType]}
        {typeGuessed && !editingFieldId && newName.trim() ? (
          <span className="text-brand"> · escolhido pelo nome</span>
        ) : null}
        {editTypes !== null
          ? editTypes.includes("location")
            ? ". Texto pode virar Local: os endereços já escritos vão para o mapa."
            : ". Já tem valores: o tipo fica travado."
          : null}
      </p>

      {newType === "select" ? (
        <div className="space-y-1.5">
          <p className="text-xs text-faint">Opções da lista (Enter adiciona)</p>
          <div
            className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-bg-soft p-1.5 focus-within:border-brand-dim"
            onClick={(event) => {
              if (event.target === event.currentTarget) optionInputRef.current?.focus()
            }}
          >
            {newOptions.map((option) => (
              <span
                key={option}
                className="inline-flex items-center gap-1 rounded-full bg-surface-hi py-0.5 pr-0.5 pl-2.5 text-sm"
              >
                {option}
                <button
                  type="button"
                  onClick={() => setNewOptions((list) => list.filter((item) => item !== option))}
                  aria-label={`Tirar ${option}`}
                  className="rounded-full p-1 text-faint transition-colors hover:bg-line hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              ref={optionInputRef}
              value={optionDraft}
              onChange={(event) => setOptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault()
                  if (optionDraft.trim()) commitOptionDraft()
                  else if (event.key === "Enter") saveComposer()
                } else if (event.key === "Backspace" && !optionDraft && newOptions.length > 0) {
                  setNewOptions((list) => list.slice(0, -1))
                }
              }}
              onBlur={commitOptionDraft}
              aria-label="Nova opção"
              placeholder={newOptions.length === 0 ? "ex.: Salão" : "mais uma…"}
              className="h-7 min-w-28 flex-1 bg-transparent px-1 text-sm outline-none focus-visible:outline-none"
            />
          </div>
        </div>
      ) : null}

      {newType === "currency" ? (
        <div role="radiogroup" aria-label="Moeda" className="flex items-center gap-1.5">
          {CURRENCY_SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              role="radio"
              aria-checked={newCurrency === symbol}
              onClick={() => setNewCurrency(symbol)}
              className={cn(
                "h-8 min-w-10 rounded-lg border px-2 text-sm transition-colors",
                newCurrency === symbol
                  ? "border-brand-dim bg-brand-wash text-foreground"
                  : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
              )}
            >
              {symbol}
            </button>
          ))}
        </div>
      ) : null}

      {fieldError ? <p className="text-xs text-danger">{fieldError}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={closeComposer}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={() => saveComposer()}>
          {editingFieldId ? "Salvar campo" : "Adicionar"}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
        <DialogContent
          onEscapeKeyDown={(event) => {
            // Esc fecha primeiro o campo pela metade, depois a lista de modelos.
            if (composerOpen) {
              event.preventDefault()
              closeComposer()
            } else if (choosingTemplate) {
              event.preventDefault()
              setView("form")
            }
          }}
          className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <DialogHeader className="flex-row items-center gap-1 px-5 pt-4 pb-2 pr-12">
            {choosingTemplate ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setView("form")}
                aria-label="Voltar ao formulário"
                className="-ml-2"
              >
                <ChevronLeft className="size-4" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle className="display text-2xl leading-tight">
                {choosingTemplate ? "Modelos" : editing ? "Editar categoria" : "Nova categoria"}
              </DialogTitle>
              <DialogDescription
                className={cn(
                  "text-xs text-faint",
                  !choosingTemplate && (editing || !folderName) && "sr-only"
                )}
              >
                {choosingTemplate
                  ? "Categorias públicas de outras pessoas. Traz só a estrutura, sem os itens."
                  : !editing && folderName
                    ? `Dentro de “${folderName}”`
                    : "Nome, campos e quem vê."}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* min-w-0: sem ele, a lista de campos alargava o diálogo além da tela no celular. */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">
            {choosingTemplate ? (
              <TemplatePicker
                onUse={applyTemplate}
                initialQuery={matches.length > 0 ? name.trim() : ""}
              />
            ) : (
              <div className="space-y-7">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <IconPicker value={icon} color={color} onChange={setIcon} />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="cat-name" className="sr-only">
                        Nome da categoria
                      </label>
                      <input
                        id="cat-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nome da categoria"
                        maxLength={60}
                        autoComplete="off"
                        autoFocus
                        className="display w-full min-w-0 border-0 border-b border-line-hi bg-transparent pt-1 pb-2 text-[1.65rem] leading-tight text-foreground outline-none transition-colors placeholder:text-faint focus:border-brand focus-visible:outline-none"
                      />
                    </div>
                  </div>

                  {canUseTemplates ? (
                    source ? (
                      <p className="flex items-start gap-2.5 rounded-xl border border-brand-dim bg-brand-wash px-3 py-2.5 text-sm text-foreground">
                        <WandSparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                          Começou de “{source.name}”, de @{source.username}. Mude o que quiser antes
                          de criar.
                        </span>
                        <button
                          type="button"
                          onClick={clearTemplate}
                          className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          Desfazer
                        </button>
                      </p>
                    ) : matches.length > 0 ? (
                      <div className="rounded-xl border border-line bg-surface px-3 pt-2.5 pb-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="plaque">Modelos parecidos</p>
                          <button
                            type="button"
                            onClick={() => setView("templates")}
                            className="text-xs text-brand underline-offset-2 hover:underline"
                          >
                            Ver todos
                          </button>
                        </div>
                        <ul className="divide-y divide-line">
                          {matches.map((template) => (
                            <li key={template.id} className="flex items-center gap-3 py-2">
                              <span
                                aria-hidden
                                className="w-7 shrink-0 text-center text-xl leading-none"
                              >
                                {template.icon || "📁"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {template.name}
                                </span>
                                <span className="block truncate text-xs text-faint">
                                  @{template.owner.username} ·{" "}
                                  {template.estrutura.map((field) => field.nome).join(", ")}
                                </span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => applyTemplate(template)}
                                className="shrink-0"
                              >
                                Usar
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : !name.trim() ? (
                      <button
                        type="button"
                        onClick={() => setView("templates")}
                        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-hi"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-wash text-brand">
                          <WandSparkles aria-hidden className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            Começar de um modelo pronto
                          </span>
                          <span className="block text-xs text-faint">
                            Restaurantes, vinhos, séries… com os campos já feitos
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setView("templates")}
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        Ver modelos prontos
                      </button>
                    )
                  ) : null}
                </div>

                <section className="space-y-2.5" aria-labelledby="cat-fields-title">
                  <h3 id="cat-fields-title" className="plaque">
                    Campos
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="plaque mr-0.5">Já vêm</span>
                    <span className={STATIC_CHIP}>
                      <Type aria-hidden className="size-3" /> Nome
                    </span>
                    <span className={STATIC_CHIP}>
                      <ImageIcon aria-hidden className="size-3" /> Imagem
                    </span>
                    {ratingEnabled ? (
                      <span className={STATIC_CHIP}>
                        <Star aria-hidden className="size-3" /> Nota
                      </span>
                    ) : null}
                  </div>

                  {fields.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                      onDragEnd={onDragEnd}
                    >
                      <SortableContext
                        items={fields.map((field) => field.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1.5">
                          {fields.map((field) => (
                            <FieldRow
                              key={field.id}
                              field={field}
                              editing={editingFieldId === field.id}
                              flash={flashId === field.id}
                              onEdit={() =>
                                editingFieldId === field.id
                                  ? closeComposer()
                                  : startEditField(field)
                              }
                              onRemove={() => {
                                setFields(fields.filter((item) => item.id !== field.id))
                                if (editingFieldId === field.id) closeComposer()
                              }}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-faint">
                      Nenhum campo extra ainda.
                    </p>
                  )}

                  {/* Sugestões de campos (migração 27): só ao criar. */}
                  {canUseTemplates ? (
                    <FieldSuggestions
                      name={name}
                      fields={fields}
                      onAdd={(added) => {
                        setFields((current) => [...current, ...added])
                        if (added.length > 0) setFlashId(added[added.length - 1].id)
                      }}
                    />
                  ) : null}

                  {composerOpen ? (
                    composer
                  ) : (
                    <button
                      type="button"
                      onClick={openNewField}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-hi px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"
                    >
                      <Plus aria-hidden className="size-4" /> Adicionar campo
                    </button>
                  )}
                </section>

                <section className="space-y-2" aria-labelledby="cat-vis-title">
                  <h3 id="cat-vis-title" className="plaque">
                    Quem vê
                  </h3>
                  <VisibilityPicker
                    kind="category"
                    value={visibility}
                    onChange={setVisibility}
                    className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
                  />
                  <p className="text-xs leading-relaxed text-faint">
                    {visibilityHint("category", visibility)}
                  </p>
                </section>

                <section className="rounded-xl border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((current) => !current)}
                    aria-expanded={moreOpen}
                    aria-controls="cat-more"
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <SlidersHorizontal aria-hidden className="size-4 shrink-0 text-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">Personalizar</span>
                      <span className="block truncate text-xs text-faint">{summary}</span>
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 text-faint transition-transform",
                        moreOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {moreOpen ? (
                    <div id="cat-more" className="divide-y divide-line px-3.5 pb-1.5">
                      <div className="space-y-2 py-3.5">
                        <p className="text-sm font-medium">Cor</p>
                        <CategoryColorPicker value={color} onChange={setColor} />
                        <p className="text-xs text-faint">
                          Tinge o card dos itens: o brilho e a borda.
                        </p>
                      </div>

                      <div className="space-y-1.5 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <p id="cat-rating-label" className="text-sm font-medium">
                            Nota de 0 a 5 em cada item
                          </p>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={ratingEnabled}
                            aria-labelledby="cat-rating-label"
                            onClick={() => {
                              const next = !ratingEnabled
                              setRatingEnabled(next)
                              // Sem estrelas não dá para abrir ordenado por nota.
                              if (!next && isRatingSort(defaultSort)) setDefaultSort("recent")
                            }}
                            className={cn(
                              "relative h-6 w-10 shrink-0 rounded-full border transition-colors",
                              ratingEnabled
                                ? "border-brand-dim bg-brand-wash"
                                : "border-line-hi bg-surface-hi"
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "absolute top-[3px] left-[3px] size-4 rounded-full transition-transform",
                                ratingEnabled ? "translate-x-4 bg-brand" : "bg-muted-foreground"
                              )}
                            />
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed text-faint">
                          {ratingEnabled
                            ? "Dá para filtrar, ordenar e comparar pela nota."
                            : "Lista simples: para organizar sem comparar."}
                          {editing && initial.ratingEnabled && !ratingEnabled
                            ? " As notas que já existem serão apagadas ao salvar."
                            : ""}
                        </p>
                      </div>

                      <div className="space-y-1.5 py-3.5">
                        <label htmlFor="cat-sort" className="block text-sm font-medium">
                          Abre ordenada por
                        </label>
                        <select
                          id="cat-sort"
                          value={defaultSort}
                          onChange={(event) => setDefaultSort(event.target.value as SortKey)}
                          className="h-9 w-full rounded-md border border-line bg-bg-soft px-2 text-sm outline-none focus-visible:border-brand-dim sm:max-w-xs"
                        >
                          {sortOptionsFor(ratingEnabled).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5 py-3.5">
                        <label htmlFor="cat-quick" className="block text-sm font-medium">
                          Acesso rápido
                        </label>
                        <select
                          id="cat-quick"
                          value={effectiveQuickField}
                          onChange={(event) => setQuickField(event.target.value)}
                          className="h-9 w-full rounded-md border border-line bg-bg-soft px-2 text-sm outline-none focus-visible:border-brand-dim sm:max-w-xs"
                        >
                          {quickFieldOptions(fields, ratingEnabled).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs leading-relaxed text-faint">
                          O campo que o Vitrine pede quando você salva algo às pressas (compartilhar
                          do celular, um lugar por perto).
                        </p>
                      </div>

                      <div className="py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={openJson}
                          className="-ml-2.5"
                        >
                          <Braces className="size-4" /> Editar campos como JSON
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row items-center gap-2 px-5 py-3 sm:justify-between">
            <span className="mr-auto min-w-0 text-xs text-faint">
              {choosingTemplate
                ? null
                : fields.length === 0
                  ? "Nenhum campo extra"
                  : plural(fields.length, "campo extra", "campos extras")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (choosingTemplate ? setView("form") : onOpenChange(false))}
                disabled={pending}
              >
                {choosingTemplate ? "Voltar" : "Cancelar"}
              </Button>
              {choosingTemplate ? null : (
                <Button type="button" onClick={handleSave} disabled={pending}>
                  {pending ? "Salvando…" : editing ? "Salvar" : "Criar"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Para quem prefere digitar: a estrutura inteira em JSON. */}
      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="display text-xl">Campos em JSON</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-faint">
              Tipos: {FIELD_TYPES.join(", ")}. O <code>id</code> de cada campo é o que liga o valor
              aos itens — mantenha os que já existem.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value)
              setJsonError(null)
            }}
            spellCheck={false}
            rows={14}
            className="max-h-[50dvh] font-mono text-xs leading-relaxed"
          />
          {jsonError ? <p className="text-xs text-danger">{jsonError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setJsonOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={applyJson}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segundo diálogo: o impacto real da mudança nos itens que já existem. */}
      <Dialog
        open={impact !== null}
        onOpenChange={(next) => {
          if (!next) {
            setImpact(null)
            setPendingEstrutura(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-xl">Isso mexe nos itens existentes</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Confira antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm">
            {(impact ?? []).map((line, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-brand">·</span>
                <span className="text-muted-foreground">{line.text}</span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setImpact(null)
                setPendingEstrutura(null)
              }}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pendingEstrutura) return
                void persist(pendingEstrutura.estrutura, pendingEstrutura.removedFieldIds, {
                  geocode: pendingEstrutura.geocode,
                })
              }}
              disabled={pending}
            >
              {pending ? "Salvando…" : "Salvar mesmo assim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
