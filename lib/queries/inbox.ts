import { isMissingColumn } from "@/lib/domain/errors"
import { createClient } from "@/lib/supabase/server"

/**
 * O id da "A organizar" de quem está logado — é para onde vão os salvamentos
 * de um toque (compartilhar, "você está em X?", "Trazer" do Match). Se por
 * algum motivo ela faltar, o banco cria na hora (`ensure_my_inbox`,
 * migração 17). `null` = a migração ainda não rodou.
 */
export async function getMyInboxId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("owner_id", userId)
    .eq("kind", "inbox")
    .maybeSingle()

  if (error && isMissingColumn(error)) return null
  if (!error && data) return (data as { id: string }).id

  const { data: created, error: rpcError } = await supabase.rpc("ensure_my_inbox")
  return rpcError || typeof created !== "string" ? null : created
}
