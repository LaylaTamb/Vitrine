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
import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  createCategoryAction,
  structureImpactAction,
  updateCategoryAction,
} from "@/app/actions"
import { FieldRow } from "@/components/category/field-row"
import { ColorPalette } from "@/components/tag/color-palette"
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
import { Textarea } from "@/components/ui/textarea"
import {
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
  FIELD_TYPE_LABELS,
  diffEstrutura,
  diffFieldOptions,
  newFieldId,
  parseEstruturaJSON,
  parseOptions,
  serializeEstrutura,
  validateField,
} from "@/lib/domain/fields"
import { plural } from "@/lib/domain/format"
import { FIELD_TYPES, type Estrutura, type FieldDef, type FieldType } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export interface CategoryEditorValue {
  id?: string
  name: string
  icon: string | null
  color: string | null
  estrutura: Estrutura
}

interface ImpactLine {
  text: string
}

export function CategoryEditor({
  open,
  onOpenChange,
  initial,
  folderId = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem `id` = criar. Com `id` = editar. */
  initial: CategoryEditorValue
  folderId?: string | null
  onSaved?: (id?: string) => void
}) {
  const editing = Boolean(initial.id)

  const [tab, setTab] = useState<"visual" | "json">("visual")
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon ?? "")
  const [color, setColor] = useState<string | null>(initial.color)
  const [fields, setFields] = useState<Estrutura>(initial.estrutura)
  const [jsonText, setJsonText] = useState(() => serializeEstrutura(initial.estrutura))
  const [jsonError, setJsonError] = useState<string | null>(null)

  const [newType, setNewType] = useState<FieldType>("str")
  const [newName, setNewName] = useState("")
  const [newOptions, setNewOptions] = useState("")
  const [newCurrency, setNewCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [fieldError, setFieldError] = useState<string | null>(null)
  /** Id do campo sendo editado agora — `null` quando o formulário é "adicionar". */
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

  const [pending, setPending] = useState(false)
  const [impact, setImpact] = useState<ImpactLine[] | null>(null)
  const [pendingEstrutura, setPendingEstrutura] = useState<{
    estrutura: Estrutura
    removedFieldIds: string[]
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

  useEffect(() => {
    if (!open) return
    const current = initialRef.current
    setTab("visual")
    setName(current.name)
    setIcon(current.icon ?? "")
    setColor(current.color)
    setFields(current.estrutura)
    setJsonText(serializeEstrutura(current.estrutura))
    setJsonError(null)
    setFieldError(null)
    setNewName("")
    setNewOptions("")
    setNewCurrency(DEFAULT_CURRENCY)
    setNewType("str")
    setEditingFieldId(null)
    setImpact(null)
  }, [open])

  function resetFieldForm() {
    setEditingFieldId(null)
    setNewName("")
    setNewOptions("")
    setNewCurrency(DEFAULT_CURRENCY)
    setNewType("str")
    setFieldError(null)
  }

  function startEditField(field: FieldDef) {
    setEditingFieldId(field.id)
    setNewType(field.tipo)
    setNewName(field.nome)
    setNewOptions((field.opcoes ?? []).join(", "))
    setNewCurrency(field.moeda ?? DEFAULT_CURRENCY)
    setFieldError(null)
  }

  function addField() {
    const opcoes = newType === "select" ? parseOptions(newOptions) : []
    const error = validateField(fields, newName, newType, opcoes)
    if (error) {
      setFieldError(error)
      return
    }
    const field = {
      id: newFieldId(),
      nome: newName.trim(),
      tipo: newType,
      ...(newType === "select" ? { opcoes } : {}),
      ...(newType === "currency" ? { moeda: newCurrency } : {}),
    }
    setFields([...fields, field])
    resetFieldForm()
  }

  function saveEditField() {
    if (!editingFieldId) return
    const current = fields.find((field) => field.id === editingFieldId)
    if (!current) return

    const opcoes = current.tipo === "select" ? parseOptions(newOptions) : []
    const error = validateField(fields, newName, current.tipo, opcoes, editingFieldId)
    if (error) {
      setFieldError(error)
      return
    }

    const updated: FieldDef = {
      id: current.id,
      nome: newName.trim(),
      tipo: current.tipo,
      ...(current.tipo === "select" ? { opcoes } : {}),
      ...(current.tipo === "currency" ? { moeda: newCurrency } : {}),
    }
    setFields(fields.map((field) => (field.id === editingFieldId ? updated : field)))
    resetFieldForm()
  }

  function switchTab(next: "visual" | "json") {
    if (next === tab) return
    resetFieldForm()
    if (next === "json") {
      setJsonText(serializeEstrutura(fields))
      setJsonError(null)
      setTab("json")
      return
    }
    // JSON → Visual só troca se o JSON for válido.
    const parsed = parseEstruturaJSON(jsonText, fields)
    if (!parsed.ok) {
      setJsonError(parsed.error)
      return
    }
    setFields(parsed.estrutura)
    setJsonError(null)
    setTab("visual")
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = fields.findIndex((field) => field.id === active.id)
    const to = fields.findIndex((field) => field.id === over.id)
    if (from < 0 || to < 0) return
    setFields(arrayMove(fields, from, to))
  }

  /** Estrutura efetiva: no modo JSON, o que está no textarea manda. */
  function currentEstrutura(): Estrutura | null {
    if (tab === "visual") return fields
    const parsed = parseEstruturaJSON(jsonText, fields)
    if (!parsed.ok) {
      setJsonError(parsed.error)
      return null
    }
    return parsed.estrutura
  }

  async function handleSave() {
    const estrutura = currentEstrutura()
    if (estrutura === null) return

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
    if (diff.added.length === 0 && diff.removed.length === 0 && optionsDiff.length === 0) {
      // Só renomeou ou reordenou: com id estável, nada a avisar.
      await persist(estrutura, [])
      return
    }

    setPending(true)
    const result = await structureImpactAction({
      categoryId: initial.id!,
      fieldIds: diff.removed.map((field) => field.id),
      fieldOptions: optionsDiff.map((entry) => ({ fieldId: entry.fieldId, options: entry.removed })),
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    const total = result.data?.total ?? 0
    const filled = result.data?.filled ?? {}
    const optionUsage = result.data?.optionUsage ?? {}

    if (total === 0) {
      await persist(estrutura, diff.removed.map((field) => field.id))
      return
    }

    const lines: ImpactLine[] = [
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
    ]

    setPendingEstrutura({ estrutura, removedFieldIds: diff.removed.map((field) => field.id) })
    setImpact(lines)
  }

  async function persist(estrutura: Estrutura, removedFieldIds: string[]) {
    setPending(true)
    const result = editing
      ? await updateCategoryAction({
          id: initial.id!,
          name: name.trim(),
          icon: icon.trim() || null,
          color,
          estrutura,
          removedFieldIds,
        })
      : await createCategoryAction({
          name: name.trim(),
          icon: icon.trim() || null,
          color,
          folderId,
          estrutura,
        })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(editing ? "Categoria atualizada." : "Categoria criada.")
    setImpact(null)
    setPendingEstrutura(null)
    onOpenChange(false)
    onSaved?.(result.ok ? (result.data as { id?: string } | undefined)?.id : undefined)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <DialogTitle className="display text-xl">
                {editing ? "Estrutura da categoria" : "Nova categoria"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Os campos que só existem nesta categoria.
              </DialogDescription>
            </div>

            <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
              {(["visual", "json"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchTab(mode)}
                  aria-pressed={tab === mode}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    tab === mode
                      ? "bg-brand-wash text-brand"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "visual" ? "Visual" : "JSON"}
                </button>
              ))}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-[3fr_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name" className="plaque">
                  Nome da categoria
                </Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Restaurantes"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon" className="plaque">
                  Ícone
                </Label>
                <Input
                  id="cat-icon"
                  value={icon}
                  maxLength={4}
                  onChange={(event) => setIcon(event.target.value)}
                  placeholder="🍽️"
                  className="text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="plaque block">Cor (opcional)</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  title="Sem cor"
                  aria-label="Sem cor"
                  aria-pressed={color === null}
                  onClick={() => setColor(null)}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-faint transition-transform",
                    color === null
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-soft)]"
                      : "hover:scale-110"
                  )}
                >
                  <X className="size-3.5" />
                </button>
                <ColorPalette value={color ?? ""} onChange={setColor} />
              </div>
              <p className="text-xs leading-relaxed text-faint">
                Tinge o card dos itens desta categoria — o brilho e a borda ficam nessa cor.
              </p>
            </div>

            <p className="rounded-lg border border-brand-dim/40 bg-brand-wash px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Toda categoria já vem com <span className="text-foreground">Nome</span>,{" "}
              <span className="text-foreground">Imagem</span> e{" "}
              <span className="text-foreground">Avaliação</span>. Os campos abaixo são os que só
              existem nesta categoria.
            </p>

            {tab === "visual" ? (
              <div className="space-y-4">
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
                            onEdit={() =>
                              editingFieldId === field.id ? resetFieldForm() : startEditField(field)
                            }
                            onRemove={() => {
                              setFields(fields.filter((item) => item.id !== field.id))
                              if (editingFieldId === field.id) resetFieldForm()
                            }}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum campo extra ainda.
                  </p>
                )}

                <div
                  className={cn(
                    "space-y-2 rounded-lg border p-3",
                    editingFieldId ? "border-brand-dim bg-brand-wash" : "border-line bg-bg-soft"
                  )}
                >
                  <p className="plaque">{editingFieldId ? "Editar campo" : "Adicionar campo"}</p>
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                    <select
                      value={newType}
                      onChange={(event) => setNewType(event.target.value as FieldType)}
                      disabled={editingFieldId !== null}
                      aria-label="Tipo do campo"
                      className="h-9 rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim disabled:opacity-60"
                    >
                      {FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {FIELD_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          if (editingFieldId) saveEditField()
                          else addField()
                        }
                      }}
                      placeholder="Nome do campo"
                      autoFocus={editingFieldId !== null}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={editingFieldId ? saveEditField : addField}
                        className="flex-1"
                      >
                        {editingFieldId ? "Salvar" : "Adicionar"}
                      </Button>
                      {editingFieldId ? (
                        <Button type="button" variant="ghost" size="icon" onClick={resetFieldForm}>
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {newType === "select" ? (
                    <Textarea
                      value={newOptions}
                      onChange={(event) => setNewOptions(event.target.value)}
                      placeholder={"Uma opção por linha, ou separadas por vírgula:\nSalão, Delivery"}
                      rows={3}
                      className="text-sm"
                    />
                  ) : null}

                  {newType === "currency" ? (
                    <div className="flex items-center gap-1.5">
                      <span className="plaque shrink-0">Moeda</span>
                      {CURRENCY_SYMBOLS.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => setNewCurrency(symbol)}
                          aria-pressed={newCurrency === symbol}
                          className={cn(
                            "h-8 min-w-9 rounded-md border px-2 text-sm transition-colors",
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
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={jsonText}
                  onChange={(event) => {
                    setJsonText(event.target.value)
                    setJsonError(null)
                  }}
                  spellCheck={false}
                  rows={14}
                  className="font-mono text-xs leading-relaxed"
                />
                {jsonError ? <p className="text-xs text-danger">{jsonError}</p> : null}
                <p className="text-xs text-faint">
                  Tipos: {FIELD_TYPES.join(", ")}. O <code>id</code> de cada campo é o que liga o
                  valor aos itens — mantenha os que já existem.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="items-center justify-between sm:justify-between">
            <span className="text-xs text-faint">
              {plural(tab === "visual" ? fields.length : fields.length, "campo extra", "campos extras")}
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
              <Button type="button" onClick={handleSave} disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
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
                void persist(pendingEstrutura.estrutura, pendingEstrutura.removedFieldIds)
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
