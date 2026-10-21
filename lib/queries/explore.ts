import { isMissingSchema, translateError } from "@/lib/domain/errors"
import {
  parseExploreResults,
  parseLinkSync,
  type ExploreCategory,
  type LinkSync,
} from "@/lib/domain/explore"
import { createClient } from "@/lib/supabase/server"

/**
 * A primeira lista do Explorar, lida no servidor (sem busca: as mais
 * copiadas). `ready = false`: a migração 26 ainda não rodou. `error`: o
 * banco recusou — a tela mostra a frase, em vez de uma lista vazia.
 */
export async function getExplore(): Promise<{
  ready: boolean
  results: ExploreCategory[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("explore_public_categories", {
    p_query: "",
    p_sort: "popular",
    p_limit: 30,
  })
  if (error) {
    return isMissingSchema(error)
      ? { ready: false, results: [], error: null }
      : { ready: true, results: [], error: translateError(error) }
  }
  return { ready: true, results: parseExploreResults(data), error: null }
}

/**
 * Sincroniza uma cópia ligada com a original (migração 26) — a página da
 * categoria chama ao abrir; o banco só trabalha se a última foi há mais de
 * 10 minutos. Antes da migração (ou se der erro), é como se não fosse ligada.
 */
export async function syncLinkedCategory(categoryId: string): Promise<LinkSync> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("sync_linked_category", {
    p_category: categoryId,
  })
  return parseLinkSync(error ? null : data)
}
