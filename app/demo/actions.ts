"use server"

import { revalidatePath } from "next/cache"

import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { DEMO_USERNAME } from "@/lib/demo/config"
import { resetDemoData } from "@/lib/demo/provision"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Só funciona logado como a própria conta demo — a checagem de sessão usa o
 * cliente normal. A gravação em si usa a `service_role`, de propósito: o
 * reset precisa recriar as tags do seed (a conta demo não tem mais permissão
 * de criar tag nenhuma, ver `06_demo_write_restrictions.sql`) — sem isso o
 * próprio reset ficaria bloqueado pela restrição que ele mesmo deveria
 * contornar. É a única gravação da conta demo que passa pela `service_role`.
 */
export async function resetDemoDataAction(): Promise<ActionResult> {
  const user = await requireUser()
  const profile = await getMyProfile()

  if (profile?.username !== DEMO_USERNAME) {
    return { ok: false, error: "Isso só existe na conta de demonstração." }
  }

  try {
    const admin = createAdminClient()
    await resetDemoData(admin, user.id)
  } catch (err) {
    return fail(err)
  }

  revalidatePath("/", "layout")
  return ok()
}
