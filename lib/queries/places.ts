import { isMissingSchema } from "@/lib/domain/errors"
import type { EntryPlace } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

/** O teto de linhas por resposta do PostgREST no Supabase (`max-rows`). */
const PAGE_SIZE = 1000

export interface MyPlaces {
  places: EntryPlace[]
  /** `false` = a tabela ainda não existe (migração 11 não rodada). */
  ready: boolean
}

/**
 * A localização de todos os itens de uma pessoa — o que vira pino no Mapa.
 * Uma ida ao banco no caso comum; só passa de mil endereços em páginas.
 */
export async function getMyPlaces(ownerId: string): Promise<MyPlaces> {
  const supabase = await createClient()
  const places: EntryPlace[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("entry_places")
      .select("*")
      .eq("owner_id", ownerId)
      .order("entry_id", { ascending: true })
      .order("field_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) return { places: [], ready: !isMissingSchema(error) }
    const rows = (data ?? []) as EntryPlace[]
    places.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }

  return { places, ready: true }
}
