"use client"

import { Plus, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { aiFieldsAction, communityFieldsAction } from "@/app/explorar/actions"
import { Button } from "@/components/ui/button"
import {
  newSuggestions,
  SUGGEST_MIN_NAME,
  suggestionToField,
  type FieldSuggestion,
} from "@/lib/domain/field-suggestions"
import { FIELD_TYPE_LABELS } from "@/lib/domain/fields"
import { plural } from "@/lib/domain/format"
import { normalizeCategoryName } from "@/lib/domain/templates"
import type { Estrutura, FieldDef } from "@/lib/domain/types"

interface Found {
  /** O nome normalizado a que estas sugestões respondem. */
  key: string
  suggestions: FieldSuggestion[]
  aiAvailable: boolean
  source: "community" | "ai"
}

/** "Lista de opções: Tinto, Branco, Rosé…" — o resumo de uma sugestão. */
function detailOf(suggestion: FieldSuggestion): string {
  const label = FIELD_TYPE_LABELS[suggestion.tipo]
  if (suggestion.tipo === "select" && suggestion.opcoes?.length) {
    const shown = suggestion.opcoes.slice(0, 3).join(", ")
    return `${label}: ${shown}${suggestion.opcoes.length > 3 ? "…" : ""}`
  }
  if (suggestion.tipo === "currency" && suggestion.moeda) return `${label} (${suggestion.moeda})`
  return label
}

/**
 * "Campos usados em categorias como essa" (migração 27), só ao criar: o que
 * outras pessoas usam em categorias públicas de nome parecido (≥ 3 pessoas).
 * Sem nada, um botão pede à IA — que recebe só o nome da categoria.
 * "Trazer" põe o campo na lista, com as opções e a moeda (e um id novo).
 */
export function FieldSuggestions({
  name,
  fields,
  onAdd,
}: {
  name: string
  fields: Estrutura
  onAdd: (fields: FieldDef[]) => void
}) {
  const [found, setFound] = useState<Found | null>(null)
  const [aiPending, setAiPending] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const key = normalizeCategoryName(name)
  // O nome do jeito que foi digitado vai junto; a busca recomeça só quando o
  // nome normalizado muda (espaço ou acento a mais não refaz a busca).
  const nameRef = useRef(name)
  nameRef.current = name

  useEffect(() => {
    if (key.length < SUGGEST_MIN_NAME) return
    let alive = true
    const timer = setTimeout(async () => {
      const result = await communityFieldsAction({ name: nameRef.current })
      if (!alive || !result.ok || !result.data) return
      setAiError(null)
      setFound({ key, ...result.data, source: "community" })
    }, 600)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [key])

  // Resposta de um nome que já não é o digitado: nada aparece.
  if (!found || found.key !== key) return null

  async function askAi() {
    if (!found) return
    setAiPending(true)
    setAiError(null)
    const result = await aiFieldsAction({ name: nameRef.current })
    setAiPending(false)
    if (!result.ok) {
      setAiError(result.error)
      return
    }
    const suggestions = result.data ?? []
    if (suggestions.length === 0) {
      setAiError("A IA não teve ideias para esse nome. Crie os campos à mão.")
      return
    }
    setFound({ ...found, suggestions, source: "ai" })
  }

  const visible = newSuggestions(found.suggestions, fields)

  if (found.suggestions.length === 0) {
    if (!found.aiAvailable) return null
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
        <p className="text-sm text-muted-foreground">
          Ninguém tem uma categoria assim ainda para sugerir campos.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={askAi} disabled={aiPending}>
          <Sparkles className="size-4" />
          {aiPending ? "Pensando…" : "Sugerir campos com IA"}
        </Button>
        {aiError ? (
          <p className="text-xs text-danger">{aiError}</p>
        ) : (
          <p className="text-xs leading-relaxed text-faint">
            Manda só o nome da categoria para o Google Gemini. Até 10 pedidos por dia.
          </p>
        )}
      </div>
    )
  }

  if (visible.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="plaque">
          {found.source === "ai" ? "Sugestões da IA" : "Campos usados em categorias como essa"}
        </p>
        {visible.length > 1 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onAdd(visible.map(suggestionToField))}
          >
            Trazer todos
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {visible.map((suggestion) => (
          <li key={suggestion.nome} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{suggestion.nome}</span>
              <span className="block truncate text-xs text-faint">
                {detailOf(suggestion)}
                {suggestion.owners
                  ? ` · ${plural(suggestion.owners, "pessoa usa", "pessoas usam")}`
                  : ""}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAdd([suggestionToField(suggestion)])}
              aria-label={`Trazer o campo ${suggestion.nome}`}
            >
              <Plus className="size-4" /> Trazer
            </Button>
          </li>
        ))}
      </ul>
      {found.source === "ai" ? (
        <p className="text-xs leading-relaxed text-faint">
          Sugerido pelo Google Gemini a partir do nome. Confira antes de criar.
        </p>
      ) : null}
    </div>
  )
}
