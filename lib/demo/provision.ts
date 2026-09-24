import type { SupabaseClient } from "@supabase/supabase-js"

import { performImport } from "@/lib/backup/import"
import { DEMO_DISPLAY_NAME, DEMO_EMAIL, DEMO_USERNAME } from "@/lib/demo/config"
import { getSeedPayload } from "@/lib/demo/seed"

async function findDemoProfileId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", DEMO_USERNAME)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Garante que a conta demo existe e está populada. A primeira visita de
 * todas cria a conta e semeia os dados; visitas seguintes só devolvem o id
 * de quem já existe — os dados ficam como o último visitante deixou, até
 * alguém clicar em "reiniciar dados de teste".
 */
export async function ensureDemoAccount(admin: SupabaseClient): Promise<string> {
  const existing = await findDemoProfileId(admin)
  if (existing) return existing

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: DEMO_DISPLAY_NAME },
  })

  if (createError || !created.user) {
    // Corrida rara: duas primeiras visitas de uma vez tentando criar junto.
    const raced = await findDemoProfileId(admin)
    if (raced) return raced
    throw new Error(createError?.message ?? "Não consegui criar a conta demo.")
  }

  const userId = created.user.id

  const { error: profileError } = await admin
    .from("profiles")
    .update({ username: DEMO_USERNAME, display_name: DEMO_DISPLAY_NAME })
    .eq("id", userId)
  if (profileError) throw new Error(profileError.message)

  // A categoria semente do gatilho de novo usuário (`seed_profile`) não
  // interessa aqui — o seed próprio da demo substitui.
  await admin.from("categories").delete().eq("owner_id", userId)

  const result = await performImport(admin, userId, getSeedPayload())
  if (!result.ok) throw new Error(result.error)

  return userId
}

/** Apaga tudo que a conta demo tem e semeia de novo do zero. */
export async function resetDemoData(admin: SupabaseClient, demoUserId: string): Promise<void> {
  const [foldersResult, categoriesResult] = await Promise.all([
    admin.from("folders").delete().eq("owner_id", demoUserId),
    admin.from("categories").delete().eq("owner_id", demoUserId),
  ])
  if (foldersResult.error) throw new Error(foldersResult.error.message)
  if (categoriesResult.error) throw new Error(categoriesResult.error.message)

  const result = await performImport(admin, demoUserId, getSeedPayload())
  if (!result.ok) throw new Error(result.error)
}
