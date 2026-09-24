"use server"

import { revalidatePath } from "next/cache"

import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { DEMO_USERNAME } from "@/lib/demo/config"
import { resetDemoData } from "@/lib/demo/provision"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Só funciona logado como a própria conta demo — usa o cliente normal (RLS
 * de dono de sempre), nunca a `service_role`. Apaga tudo que a conta demo
 * tem e semeia de novo, pros próximos visitantes começarem limpo.
 */
export async function resetDemoDataAction(): Promise<ActionResult> {
  const user = await requireUser()
  const profile = await getMyProfile()

  if (profile?.username !== DEMO_USERNAME) {
    return { ok: false, error: "Isso só existe na conta de demonstração." }
  }

  try {
    const supabase = await createClient()
    await resetDemoData(supabase, user.id)
  } catch (err) {
    return fail(err)
  }

  revalidatePath("/", "layout")
  return ok()
}
