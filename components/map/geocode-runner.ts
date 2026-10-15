import { toast } from "sonner"

import type { GeocodeBatchResult, VitrineActions } from "@/lib/actions/contracts"
import { plural } from "@/lib/domain/format"
import type { GeocodeMode } from "@/lib/domain/places"

/*
 * Quem dispara a busca de endereços a partir da tela. Nada aqui segura um
 * formulário: o item (ou a categoria) já foi salvo, e a localização roda
 * depois, com o resultado em toast.
 */

/** 100 lotes de 20: até 2.000 endereços numa rodada. */
const MAX_ROUNDS = 100

/** Depois de salvar um item: procura os endereços dele que mudaram. */
export async function geocodeAfterSave(actions: VitrineActions, entryId: string): Promise<void> {
  const result = await actions.geocodeEntryLocations({ entryId })
  if (!result.ok) {
    toast.error(`${result.error} O item foi salvo, mas o endereço ainda não aparece no mapa.`)
    return
  }
  for (const field of result.data?.results ?? []) {
    if (field.status === "not_found") {
      toast.warning(
        `Não consegui localizar “${field.address}”. O item foi salvo, mas não aparece no mapa.`
      )
    } else if (field.status === "error") {
      toast.error(`${field.error} O item foi salvo, mas “${field.address}” ainda não aparece no mapa.`)
    }
  }
}

/**
 * Localiza em lotes tudo que está pendente — no acervo inteiro ou numa
 * categoria —, chamando o servidor de novo enquanto houver fila. Uma rodada
 * sem nenhum acerto (só falhas: créditos do dia, chave, rede) encerra:
 * insistir só gastaria crédito.
 */
export async function runPendingGeocode(
  actions: VitrineActions,
  input: { categoryId?: string; mode?: GeocodeMode }
): Promise<GeocodeBatchResult | null> {
  // Falha registrada a partir daqui não é tentada de novo nesta rodada.
  const startedAt = new Date().toISOString()
  const toastId = toast.loading("Procurando os endereços…")
  const total: GeocodeBatchResult = { located: 0, notFound: 0, failed: 0, remaining: 0 }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await actions.geocodePendingLocations({ ...input, startedAt })
    if (!result.ok) {
      toast.error(result.error, { id: toastId })
      return null
    }
    const batch = result.data ?? { located: 0, notFound: 0, failed: 0, remaining: 0 }
    total.located += batch.located
    total.notFound += batch.notFound
    total.failed += batch.failed
    total.remaining = batch.remaining
    total.error = batch.error ?? total.error

    if (batch.remaining === 0 || batch.located + batch.notFound === 0) break
    const done = total.located + total.notFound + total.failed
    toast.loading(`Procurando os endereços… ${done} prontos, faltam ${batch.remaining}.`, {
      id: toastId,
    })
  }

  const parts = [
    total.located > 0 ? plural(total.located, "endereço localizado", "endereços localizados") : "",
    total.notFound > 0 ? plural(total.notFound, "não encontrado", "não encontrados") : "",
    total.failed > 0 ? `${total.failed} com erro` : "",
    total.remaining > 0 ? `faltam ${total.remaining}` : "",
  ].filter(Boolean)

  if (parts.length === 0) {
    toast.success("Nada pendente: os endereços já estão no mapa.", { id: toastId })
  } else if (total.failed > 0) {
    toast.error(`${parts.join(" · ")}. ${total.error ?? ""}`.trim(), { id: toastId })
  } else if (total.notFound > 0) {
    toast.warning(`${parts.join(" · ")}. Os não encontrados aparecem no Mapa para corrigir.`, {
      id: toastId,
    })
  } else {
    toast.success(`${parts.join(" · ")}.`, { id: toastId })
  }

  return total
}
