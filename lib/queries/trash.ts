import { isMissingSchema } from "@/lib/domain/errors"
import { parseTrashItems, type TrashItem } from "@/lib/domain/trash"
import { createClient } from "@/lib/supabase/server"

/**
 * A lixeira de quem está logado (migração 37), da mais nova para a mais
 * velha. Antes de ler, o que passou de 30 dias some (`purge_my_expired_trash`):
 * assim a limpeza não depende só do Cron. `ready = false`: a migração não rodou.
 */
export async function getMyTrash(): Promise<{ ready: boolean; items: TrashItem[] }> {
  const supabase = await createClient()
  await supabase.rpc("purge_my_expired_trash")
  const { data, error } = await supabase
    .from("trash_items")
    .select("id, kind, name, icon, location, item_count, deleted_at, purge_after")
    .order("deleted_at", { ascending: false })
  if (error) return { ready: !isMissingSchema(error), items: [] }
  return { ready: true, items: parseTrashItems(data) }
}

/** Quantas coisas há na lixeira — o número no ícone das Coleções. 0 antes da migração. */
export async function getMyTrashCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("trash_items")
    .select("id", { count: "exact", head: true })
  return error ? 0 : (count ?? 0)
}
