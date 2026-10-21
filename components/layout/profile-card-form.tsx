"use client"

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { updateProfileCardAction } from "@/app/configuracoes/actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  BIO_MAX,
  CARD_MAX_CATEGORIES,
  CARD_NOT_READY,
  moveCardId,
} from "@/lib/domain/card"
import { itemCount } from "@/lib/domain/format"

export interface CardCategoryOption {
  id: string
  name: string
  icon: string | null
  total: number
}

const ICON_BUTTON =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground disabled:pointer-events-none disabled:opacity-30"

/**
 * Meu perfil → Editar cartão: a bio e as categorias do cartão (só as
 * públicas aparecem para escolher; até 5, na ordem). Os links das redes são
 * o `SocialLinksForm`, logo abaixo.
 */
export function ProfileCardForm({
  ready,
  initialBio,
  initialIds,
  options,
  names,
}: {
  /** A migração 23 já rodou? */
  ready: boolean
  initialBio: string
  initialIds: string[]
  /** As categorias que podem ir para o cartão (públicas de fato). */
  options: CardCategoryOption[]
  /** Todas as categorias da pessoa — para nomear uma escolhida que deixou de ser pública. */
  names: Record<string, string>
}) {
  const [bio, setBio] = useState(initialBio)
  const [ids, setIds] = useState(initialIds.filter((id) => id in names))
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  const byId = new Map(options.map((option) => [option.id, option]))
  const available = options.filter((option) => !ids.includes(option.id))
  const full = ids.length >= CARD_MAX_CATEGORIES

  function change(next: () => void) {
    next()
    setSaved(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    const result = await updateProfileCardAction({ bio, categoryIds: ids })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSaved(true)
    toast.success("Cartão salvo.")
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {ready ? null : (
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          {CARD_NOT_READY}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="card-bio" className="plaque">
          Bio
        </Label>
        <Textarea
          id="card-bio"
          value={bio}
          onChange={(event) => change(() => setBio(event.target.value.slice(0, BIO_MAX)))}
          maxLength={BIO_MAX}
          rows={3}
          placeholder="Do que você gosta, o que anda vendo, lendo, jogando…"
          aria-describedby="card-bio-count"
        />
        <p id="card-bio-count" className="text-right text-xs text-faint tabular-nums">
          {bio.length}/{BIO_MAX}
        </p>
      </div>

      <div className="space-y-2">
        <div className="space-y-0.5">
          <p className="plaque">Categorias no cartão</p>
          <p className="text-xs leading-relaxed text-faint">
            Até {CARD_MAX_CATEGORIES}, só as públicas. Cada uma mostra os 3 melhores itens (maior
            nota; sem estrelas, os 3 primeiros da sua ordem).
          </p>
        </div>

        {ids.length > 0 ? (
          <ol className="divide-y divide-line rounded-lg border border-line">
            {ids.map((id, index) => {
              const option = byId.get(id)
              return (
                <li key={id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-4 text-xs text-faint tabular-nums">{index + 1}</span>
                  <span aria-hidden>{option?.icon || "📁"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {option?.name ?? names[id]}
                    </span>
                    {option ? null : (
                      <span className="block text-xs text-danger">
                        Não é pública agora: não aparece no cartão.
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={index === 0}
                    onClick={() =>
                      change(() => setIds((current) => moveCardId(current, index, -1)))
                    }
                    aria-label={`Subir ${option?.name ?? names[id]}`}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={index === ids.length - 1}
                    onClick={() =>
                      change(() => setIds((current) => moveCardId(current, index, 1)))
                    }
                    aria-label={`Descer ${option?.name ?? names[id]}`}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    onClick={() =>
                      change(() => setIds((current) => current.filter((item) => item !== id)))
                    }
                    aria-label={`Tirar ${option?.name ?? names[id]} do cartão`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              )
            })}
          </ol>
        ) : null}

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma categoria pública ainda. Deixe uma como Pública (no topo dela) para ela poder
            entrar no cartão.
          </p>
        ) : available.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {available.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={full}
                onClick={() => change(() => setIds((current) => [...current, option.id]))}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Plus aria-hidden className="size-3.5 shrink-0" />
                <span aria-hidden>{option.icon || "📁"}</span>
                <span className="truncate">{option.name}</span>
                <span className="shrink-0 text-xs text-faint">{itemCount(option.total)}</span>
              </button>
            ))}
          </div>
        ) : null}
        {full && available.length > 0 ? (
          <p className="text-xs text-faint">O cartão está cheio: tire uma para pôr outra.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <div className="flex items-center gap-3">
          {saved ? <span className="text-xs text-muted-foreground">Cartão salvo.</span> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar cartão"}
          </Button>
        </div>
      </div>
    </form>
  )
}
