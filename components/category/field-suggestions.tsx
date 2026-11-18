"use client"

import { Plus, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { aiFieldsAction, communityFieldsAction } from "@/app/explorar/actions"
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

const CHIP =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-line-hi px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground disabled:cursor-wait disabled:opacity-60"

interface Found {
  /** O nome normalizado a que estas sugestões respondem. */
  key: string
  suggestions: FieldSuggestion[]
  aiAvailable: boolean
  source: "community" | "ai"
  /** O banco recusou a busca: a frase, no lugar das sugestões. */
  error?: string
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
 * outras pessoas usam em categorias públicas de nome parecido (basta uma
 * pessoa — migração 32). Sem nada, um botão pede à IA — que recebe só o nome
 * da categoria —, ou, sem a IA no servidor, nada aparece.
 * Cada sugestão é uma etiqueta: um toque põe o campo na lista, com as opções e
 * a moeda (e um id novo).
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
      if (!alive) return
      setAiError(null)
      if (!result.ok || !result.data) {
        setFound({
          key,
          suggestions: [],
          aiAvailable: false,
          source: "community",
          error: result.ok ? undefined : result.error,
        })
        return
      }
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

  if (found.error) {
    return (
      <p className="text-xs text-muted-foreground">
        Não deu para buscar campos sugeridos agora: {found.error}
      </p>
    )
  }

  if (found.suggestions.length === 0) {
    // Sem a IA no servidor, não há o que oferecer: o silêncio é melhor que um recado.
    if (!found.aiAvailable) return null
    return (
      <div className="space-y-1.5">
        <button type="button" onClick={askAi} disabled={aiPending} className={CHIP}>
          <Sparkles aria-hidden className="size-3.5 text-brand" />
          {aiPending ? "Pensando…" : "Sugerir campos com IA"}
        </button>
        {aiError ? (
          <p className="text-xs text-danger">{aiError}</p>
        ) : (
          <p className="text-xs leading-relaxed text-faint">
            Ninguém tem uma categoria assim ainda. A IA (Google Gemini) recebe só o nome, até 10
            vezes por dia.
          </p>
        )}
      </div>
    )
  }

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="plaque min-w-0 [overflow-wrap:anywhere]">
          {found.source === "ai" ? "Sugestões da IA" : "Usados em categorias como essa"}
        </p>
        {visible.length > 1 ? (
          <button
            type="button"
            onClick={() => onAdd(visible.map(suggestionToField))}
            className="shrink-0 text-xs text-brand underline-offset-2 hover:underline"
          >
            Trazer todos
          </button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {visible.map((suggestion) => (
          <li key={suggestion.nome}>
            <button
              type="button"
              onClick={() => onAdd([suggestionToField(suggestion)])}
              title={`${detailOf(suggestion)}${
                suggestion.owners
                  ? ` · ${plural(suggestion.owners, "pessoa usa", "pessoas usam")}`
                  : ""
              }`}
              aria-label={`Trazer o campo ${suggestion.nome} (${detailOf(suggestion)})`}
              className={CHIP}
            >
              <Plus aria-hidden className="size-3.5 text-brand" />
              {suggestion.nome}
            </button>
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
